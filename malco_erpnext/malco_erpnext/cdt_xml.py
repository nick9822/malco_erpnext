import frappe
from lxml import etree
import HTMLParser

class CdtXML:
    def __init__(self, docname):
        self.xmlTree = {}
        self.curXmlStructIdx = 0
        self.cur_doc = frappe.get_doc("Project", docname)
        self.cdt = frappe.get_doc("Customs Document Type", self.cur_doc.customs_document_type)
        self.top_parent_tag = self.cdt.xml_structure[0].xml_tag_name
               
        self.customer = frappe._dict(address=None, eori_number=None, representation_type=None)
        self.customer.address = frappe.get_doc("Address", self.cur_doc.customer+"-Billing")
        self.customer.address.country = frappe.db.get_value("Country", self.customer.address.country, "code")
        self.customer.eori_number = frappe.db.get_value("Customer", self.cur_doc.customer, "eori_number")
        self.customer.representation_type = frappe.db.get_value("Customer", self.cur_doc.customer, "representation_type")

        self.house_master = frappe._dict(address=None, eori_number=None)
        self.house_master.address = frappe.get_doc("Address", self.cur_doc.house_master+"-Billing")
        self.house_master.address.country = frappe.db.get_value("Country", self.house_master.address.country, "code")
        self.house_master.eori_number = frappe.db.get_value("Customer", self.cur_doc.house_master, "eori_number")

        self.customs_agent_master = frappe._dict(address=None, eori_number=None)
        self.customs_agent_master.address = frappe.get_doc("Address", self.cur_doc.customs_agent_master+"-Billing")
        self.customs_agent_master.address.country = frappe.db.get_value("Country", self.customs_agent_master.address.country, "code")
        self.customs_agent_master.eori_number = frappe.db.get_value("Supplier", self.cur_doc.customs_agent_master, "eori_number")

        # show warnings and increase XML counter

    def startXmlOld(self):
        for tLIdx, e in enumerate(self.cdt.xml_structure):
            if e.is_loop and e.loop_field_name:
                loop_items = getattr(self.cur_doc, e.loop_field_name)
                for idx, loop_item in enumerate(loop_items):
                    for cLIdxm, f in enumerate(self.cdt.xml_structure):
                        if cLIdxm < tLIdx:
                            continue
                        if f.loop_field_name and e.loop_field_name != f.loop_field_name:
                            break
                        self.createElement(f, loop_item, idx)
            else:
                self.createElement(e, None, 0)
        print(etree.tostring(self.xmlTree["CC515A"]))

    def startXml(self):
        self.initCreate(None, 0)
        self.remove_duplicate_tags()
        print(etree.tostring(self.xmlTree[self.top_parent_tag], encoding='utf-8', xml_declaration=True))
        return etree.tostring(self.xmlTree[self.top_parent_tag], encoding='utf-8', xml_declaration=True)
    
    def initCreate(self, loop_item, idx):
        jumpIdx = 0
        for tLIdx, e in enumerate(self.cdt.xml_structure):
            print("JMP Idx "+str(jumpIdx)+" loop idx "+str(tLIdx)+" loop item "+ str(loop_item))
            if idx != 0 and tLIdx <= idx:
                continue
            
            if jumpIdx > 0 and tLIdx <= jumpIdx:
                continue

            if e.depends_on and e.depends_on != "" and e.depends_on != None:
                if CdtXML.execute_formula(e.depends_on, self) == False:
                    continue

            if e.is_loop and e.loop_field_name:
                loop_items = getattr(self.cur_doc, e.loop_field_name)
                for llidx, li in enumerate(loop_items):
                    if llidx > 0 and e.allow_only_in_first_iteration:
                        return tLIdx
                    self.createElement(e, li, llidx)
                    print("Initiating Loop..."+li.doctype+" "+str(tLIdx))
                    jumpIdx = self.initCreate(li, tLIdx)
                
                if len(loop_items) == 0:
                    for fJIdx, f in enumerate(self.cdt.xml_structure):
                        if fJIdx <= tLIdx:
                            continue

                        if f.last_field_of_loop:
                            print("Setting up zero items loop jump to "+str(fJIdx))
                            jumpIdx = fJIdx
                            break
            else:
                print("Creating..."+e.xml_tag_name)
                if loop_item:
                    print("Loop Item..."+loop_item.doctype+" "+str(idx))
                
                self.createElement(e, loop_item, idx)
                if e.last_field_of_loop: 
                    print("Last field of loop..."+e.xml_tag_name)
                    return tLIdx
            self.curXmlStructIdx = tLIdx
        return len(self.cdt.xml_structure)-1
    
    def createElement(self, tag, loop_item, idx):
        ele = etree.Element(tag.xml_tag_name)
        ele_txt = ""
        if tag.local_field_name and not tag.nl_field_link:
            if loop_item:
                frags = tag.local_field_name.split(".")
                if len(frags) > 1:
                    ele_txt = getattr(loop_item, frags[1])
                else:
                    ele_txt = getattr(self.cur_doc, tag.local_field_name)    
            else:
                ele_txt = getattr(self.cur_doc, tag.local_field_name)
        elif tag.nl_field_link:
            ele_txt = frappe.db.get_value(tag.nl_field_link, getattr(self.cur_doc, tag.nl_field_name), tag.local_field_name)
        elif tag.text_field_value:
            ele_txt = tag.text_field_value
        elif tag.functional_formula:
            ele_txt = CdtXML.execute_formula(tag.functional_formula, self)

        if tag.dont_allow_blank and (ele_txt=="" or ele_txt==None):
            return
        
        if ele_txt and tag.trim_chars > 0:
            ele_txt = ele_txt[:tag.trim_chars]

        if tag.precision > 0:
            ele_txt = round(ele_txt, tag.precision)

        ele.text = u'{0}'.format(ele_txt) if (ele_txt or ele_txt >= 0) else ""

        if tag.xml_parent_tag:
            doc = self.xmlTree[tag.xml_parent_tag]
            doc.append(ele)
        
        self.xmlTree[tag.xml_tag_name] = ele

    @staticmethod
    def execute_formula(formula, loc_globals):
        formula = HTMLParser.HTMLParser().unescape(formula)
        loc_dict = loc_globals.__dict__
        loc_dict["frappe"] = frappe

        loc = {}
        exec(formula, loc_globals.__dict__, loc)
        r = loc.get("exportVar", "")
        return r if r != None else ""
    
    def remove_duplicate_tags(self):
        projdoc = self.cur_doc
        # html_en = html2text.html2text(projdoc.xml_html)        
        # h = HTMLParser.HTMLParser()
        # xmld = h.unescape(html_en).encode('utf8')
        # root = etree.fromstring(xmld)
        print(self.top_parent_tag)
        for crew in self.xmlTree[self.top_parent_tag].xpath('.//GOOITEGDS'):
                i_index = crew.find("IteNumGDS7").text
                if int(i_index) > 1:
                        for rcrew in crew.xpath('.//CONNR2'):
                                rcrew.getparent().remove(rcrew)
                        for rcrew in crew.xpath('.//TAXADDELE100'):
                                rcrew.getparent().remove(rcrew)
                hs_code = projdoc.commodities_data[int(i_index)-1].hs_code
                for idx, ccrew in enumerate(crew.xpath('.//PRODOCDC2')):
                        score = 0
                        vdoc = ccrew.find("DocTypDC21").text
                        for idxx, e in enumerate(projdoc.customs_attachments):
                                if e.document_code == vdoc and e.hs_code == hs_code and idx == idxx:
                                        score = score + 1
                        if score == 0:
                                ccrew.getparent().remove(ccrew)
                for idx, ccrew in enumerate(crew.xpath('.//CALTAXGOD')):
                        score = 0
                        vdoc = ccrew.find("TypOfTaxCTX1").text
                        for idxx, e in enumerate(projdoc.customs_duties_analysis):
                                if e.customs_charges_code == vdoc and e.hs_code == hs_code and idx == idxx:
                                        score = score + 1
                        if score == 0:
                                ccrew.getparent().remove(ccrew)
        # op = etree.tostring(root, pretty_print=True)
        # return h.unescape(op)
