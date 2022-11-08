import frappe
from lxml import etree

class CdtXML:
    def __init__(self, docname):
        self.xmlTree = {}
        self.curXmlStructIdx = 0
        self.cur_doc = frappe.get_doc("Project", docname)
        self.cdt = frappe.get_doc("Customs Document Type", self.cur_doc.customs_document_type)
        self.customer = frappe._dict(address=None, eori_number=None)
        self.house_master = frappe._dict(address=None, eori_number=None)

        self.customer.address = frappe.get_doc("Address", self.cur_doc.customer+"-Billing")
        self.house_master.address = frappe.get_doc("Address", self.cur_doc.house_master+"-Billing")

        self.customer.eori_number = frappe.db.get_value("Customer", self.cur_doc.customer, "eori_number")
        self.house_master.eori_number = frappe.db.get_value("Customer", self.cur_doc.house_master, "eori_number")

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
        print(etree.tostring(self.xmlTree["CC515A"]))
    
    def initCreate(self, loop_item, idx):
        for tLIdx, e in enumerate(self.cdt.xml_structure):
            if idx != 0 and tLIdx <= idx:
                continue
            if e.is_loop and e.loop_field_name:
                loop_items = getattr(self.cur_doc, e.loop_field_name)
                for llidx, li in enumerate(loop_items):
                    if llidx > 0 and e.allow_only_in_first_iteration:
                        return
                    self.createElement(e, li, llidx)
                    print("Initiating Loop..."+li.doctype+" "+str(tLIdx))
                    self.initCreate(li, tLIdx)
                return
            else:
                print("Creating..."+e.xml_tag_name)
                if loop_item:
                    print("Loop Item..."+loop_item.doctype+" "+str(idx))
                self.createElement(e, loop_item, idx)
            self.curXmlStructIdx = tLIdx
    
    def createElement(self, tag, loop_item, idx):
        ele = etree.Element(tag.xml_tag_name)
        ele_txt = ""
        if tag.local_field_name:
            if loop_item:
                frags = tag.local_field_name.split(".")
                if len(frags) > 1:
                    ele_txt = getattr(loop_item, frags[1])
                else:
                    ele_txt = getattr(self.cur_doc, tag.local_field_name)    
            else:
                ele_txt = getattr(self.cur_doc, tag.local_field_name)
        elif tag.nl_field_link:
            ele_txt = frappe.db.get_value(tag.nl_field_link, tag.nl_field_name, tag.local_field_name)
        elif tag.text_field_value:
            ele_txt = tag.text_field_value
        elif tag.functional_formula:
            ele_txt = CdtXML.execute_formula(tag.functional_formula, self)

        if tag.dont_allow_blank and (ele_txt=="" or ele_txt==None):
            return
        
        if tag.trim_chars > 0:
            ele_txt = ele_txt[:tag.trim_chars]

        ele.text = u'{0}'.format(ele_txt) if ele_txt else ""

        if tag.xml_parent_tag:
            doc = self.xmlTree[tag.xml_parent_tag]
            doc.append(ele)
        
        self.xmlTree[tag.xml_tag_name] = ele

    @staticmethod
    def execute_formula(formula, loc_globals):
        loc_dict = loc_globals.__dict__
        loc_dict["frappe"] = frappe

        loc = {}
        exec(formula, loc_globals.__dict__, loc)
        r = loc.get("exportVar", "")
        return r if r != None else ""
