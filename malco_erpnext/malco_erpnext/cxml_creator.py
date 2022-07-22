# -*- coding: utf-8 -*-
# Copyright (c) 2017, GoElite and contributors
# For license information, please see license.txt

from __future__ import unicode_literals

import frappe, os, copy, json, re
from frappe import _
from lxml import etree
from datetime import datetime

inv = None
line = None
idx = None
company_details = None
company_address = None
customer_details = None
customer_address = None

def create_xml_tags_recur(x, i, doc, currentLoop=None):
    page = None
    
    if not x.loopPyfunc and currentLoop == None and x.loopName != None:
        return doc

    if i==0: 
        page = etree.Element(x.tag)
        for v in x.attributes:
            if v.pyfunc != None:
                page.set(v.attribName, eval(v.pyfunc))
            else:
                page.set(v.attribName, v.staticVal)
        doc = etree.ElementTree(page)
        return doc
    
    parent = doc.findall('.//'+x.parent)
    
    if x.loopPyfunc:
        loopElements = eval(x.loopPyfunc)
        # print(loopElements)
        if loopElements:
            for z in loopElements:
                parent[len(parent)-1].append(z.getroot())

    if not x.loopPyfunc:
        if parent:
            pageElement = etree.SubElement(parent[len(parent)-1], x.tag)
        else:
            parent = doc.getroot()
            pageElement = etree.SubElement(parent, x.tag)
        
        for v in x.attributes:
            if v.pyfunc != None:
                pageElement.set(v.attribName, eval(v.pyfunc))
            else:
                pageElement.set(v.attribName, v.staticVal)

        if x.pyfunc:
            pageElement.text = eval(x.pyfunc)
        elif x.staticVal:
            pageElement.text = x.staticVal
            
        page = pageElement
    return doc

def invoice_lines(lines):
    global line, idx, company_details, company_address, customer_details, customer_address
    xml_tag_list = []
    loop_tags = [e for e in invoice_cxml if e.loopName=="invoiceLines"]
    print(loop_tags)
    docTree = []
    
    for linex in lines:
        idx = 0
        doc = ""
        line = linex
        
        for idx1, x in enumerate(loop_tags):
            idx = idx1
            doc = create_xml_tags_recur(x, idx, doc, "invoiceLines") 

        if doc:
            docTree.append(doc)
            # # Save to XML file
            outFile = open('output1-recur-p.xml', 'wb')
            doc.write(outFile, xml_declaration=True, encoding='utf-8')                 
    
    line = None
    idx = None
    
    return docTree


class MalcoXMLElement:
    def __init__(self, tag, staticVal, pyfunc, parent, attributes, loopPyfunc=None, loopName=None):
        self.tag = tag
        self.staticVal = staticVal
        self.pyfunc = pyfunc
        self.parent = parent
        self.attributes = attributes
        self.loopPyfunc = loopPyfunc
        self.loopName = loopName

class MalcoXMLAttribute:
    def __init__(self, attribName, staticVal, pyfunc):
        self.attribName = attribName
        self.staticVal = staticVal
        self.pyfunc = pyfunc


invoice_cxml = [
    MalcoXMLElement(tag="cXML", staticVal=None, pyfunc=None, parent=None, attributes=[
        MalcoXMLAttribute(attribName="timestamp", staticVal= None, pyfunc="""(inv.posting_date+inv.posting_time).strftime("%Y-%m-%d,%H:%M:%S")"""),
        MalcoXMLAttribute(attribName="xmllang", staticVal= "en-GB", pyfunc=None),
        MalcoXMLAttribute(attribName="payloadID", staticVal= None, pyfunc=""""MALCOCXML-"+inv.name"""),
    ]),
    
    #################### Header Starts
    MalcoXMLElement(tag="Header", staticVal=None, pyfunc=None, parent="cXML", attributes=[]),

    MalcoXMLElement(tag="From", staticVal=None, pyfunc=None, parent="Header", attributes=[]),
    MalcoXMLElement(tag="Credential", staticVal=None, pyfunc=None, parent="From", attributes=[
        MalcoXMLAttribute(attribName="domain", staticVal="DUNS", pyfunc=None)
    ]),
    MalcoXMLElement(tag="Identity", staticVal="n/a", pyfunc=None, parent="Credential", attributes=[]),

    MalcoXMLElement(tag="To", staticVal=None, pyfunc=None, parent="Header", attributes=[]),
    MalcoXMLElement(tag="Credential", staticVal=None, pyfunc=None, parent="To", attributes=[
        MalcoXMLAttribute(attribName="domain", staticVal="DUNS", pyfunc=None)
    ]),
    MalcoXMLElement(tag="Identity", staticVal="n/a", pyfunc=None, parent="Credential", attributes=[]),

    MalcoXMLElement(tag="Sender", staticVal=None, pyfunc=None, parent="Header", attributes=[]),
    MalcoXMLElement(tag="Credential", staticVal=None, pyfunc=None, parent="Sender", attributes=[
        MalcoXMLAttribute(attribName="domain", staticVal="DUNS", pyfunc=None)
    ]),
    MalcoXMLElement(tag="Identity", staticVal="n/a", pyfunc=None, parent="Credential", attributes=[]),
    MalcoXMLElement(tag="UserAgent", staticVal="MALCO ERP", pyfunc=None, parent="Sender", attributes=[]),

    #################### Header Ends

    #################### Request Starts
    MalcoXMLElement(tag="Request", staticVal=None, pyfunc=None, parent="cXML", attributes=[]),

    MalcoXMLElement(tag="InvoiceDetailRequest", staticVal=None, pyfunc=None, parent="Request", attributes=[]),

    MalcoXMLElement(tag="InvoiceDetailRequestHeader", staticVal=None, pyfunc=None, parent="InvoiceDetailRequest", attributes=[
        MalcoXMLAttribute(attribName="invoiceID", staticVal=None, pyfunc="inv.name"),
        MalcoXMLAttribute(attribName="invoiceDate", staticVal=None, pyfunc="""(inv.posting_date+inv.posting_time).strftime("%Y-%m-%d,%H:%M:%S")"""),
        MalcoXMLAttribute(attribName="purpose", staticVal="standard", pyfunc=None),
        MalcoXMLAttribute(attribName="operation", staticVal="new", pyfunc=None),
        MalcoXMLAttribute(attribName="invoiceOrigin", staticVal="supplier", pyfunc=None),
    ]),

    MalcoXMLElement(tag="InvoiceDetailHeaderIndicator", staticVal=None, pyfunc=None, parent="InvoiceDetailRequestHeader", attributes=[
        MalcoXMLAttribute(attribName="isVatRecoverable", staticVal="yes", pyfunc=None)
    ]),
    MalcoXMLElement(tag="InvoiceDetailLineIndicator", staticVal=None, pyfunc=None, parent="InvoiceDetailRequestHeader", attributes=[
        MalcoXMLAttribute(attribName="isTaxInLine", staticVal="yes", pyfunc=None)
    ]),

    # Company address
    MalcoXMLElement(tag="InvoicePartner", staticVal=None, pyfunc=None, parent="InvoiceDetailRequestHeader", attributes=[]),
    MalcoXMLElement(tag="Contact", staticVal=None, pyfunc=None, parent="InvoicePartner", attributes=[
        MalcoXMLAttribute(attribName="role", staticVal="issuerOfInvoice", pyfunc=None),
        MalcoXMLAttribute(attribName="addressID", staticVal="", pyfunc=None)
    ]),
    MalcoXMLElement(tag="Name", staticVal=None, pyfunc="inv.company", parent="Contact", attributes=[
        MalcoXMLAttribute(attribName="xmllang", staticVal="en-GB", pyfunc=None),
    ]),
    MalcoXMLElement(tag="PostalAddress", staticVal=None, pyfunc=None, parent="Contact", attributes=[
        MalcoXMLAttribute(attribName="name", staticVal="default", pyfunc=None),
    ]),
    MalcoXMLElement(tag="DeliverTo", staticVal=None, pyfunc="inv.company", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="Street", staticVal=None, pyfunc="company_address.address_line1", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="City", staticVal=None, pyfunc="company_address.city", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="State", staticVal=None, pyfunc="company_address.state", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="PostalCode", staticVal=None, pyfunc="company_address.pincode", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="Country", staticVal=None, pyfunc="company_address.country", parent="PostalAddress", attributes=[
        MalcoXMLAttribute(attribName="isoCountryCode", staticVal="GR", pyfunc=None),
    ]),
    MalcoXMLElement(tag="IdReference", staticVal=None, pyfunc=None, parent="InvoicePartner", attributes=[
        MalcoXMLAttribute(attribName="identifier", staticVal=None, pyfunc="company_details.tax_id"),
        MalcoXMLAttribute(attribName="domain", staticVal="vatID", pyfunc=None)
    ]),

    # Customer address
    MalcoXMLElement(tag="InvoicePartner", staticVal=None, pyfunc=None, parent="InvoiceDetailRequestHeader", attributes=[]),
    MalcoXMLElement(tag="Contact", staticVal=None, pyfunc=None, parent="InvoicePartner", attributes=[
        MalcoXMLAttribute(attribName="role", staticVal="billTo", pyfunc=None),
        MalcoXMLAttribute(attribName="addressID", staticVal="", pyfunc=None)
    ]),
    MalcoXMLElement(tag="Name", staticVal=None, pyfunc="inv.customer", parent="Contact", attributes=[
        MalcoXMLAttribute(attribName="xmllang", staticVal="en-GB", pyfunc=None),
    ]),
    MalcoXMLElement(tag="PostalAddress", staticVal=None, pyfunc=None, parent="Contact", attributes=[
        MalcoXMLAttribute(attribName="name", staticVal="default", pyfunc=None),
    ]),
    MalcoXMLElement(tag="DeliverTo", staticVal=None, pyfunc="inv.customer", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="Street", staticVal=None, pyfunc="customer_address.address_line1", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="City", staticVal=None, pyfunc="customer_address.city", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="State", staticVal=None, pyfunc="customer_address.state", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="PostalCode", staticVal=None, pyfunc="customer_address.pincode", parent="PostalAddress", attributes=[]),
    MalcoXMLElement(tag="Country", staticVal=None, pyfunc="customer_address.country", parent="PostalAddress", attributes=[
        MalcoXMLAttribute(attribName="isoCountryCode", staticVal="GR", pyfunc=None),
    ]),
    MalcoXMLElement(tag="IdReference", staticVal=None, pyfunc=None, parent="InvoicePartner", attributes=[
        MalcoXMLAttribute(attribName="identifier", staticVal=None, pyfunc="customer_details.tax_id"),
        MalcoXMLAttribute(attribName="domain", staticVal="vatID", pyfunc=None)
    ]),

    MalcoXMLElement(tag="InvoiceDetailOrder", staticVal=None, pyfunc=None, parent="InvoiceDetailRequest", attributes=[]),
    MalcoXMLElement(tag="InvoiceDetailOrderInfo", staticVal=None, pyfunc=None, parent="InvoiceDetailOrder", attributes=[]),
    MalcoXMLElement(tag="OrderReference", staticVal=None, pyfunc=None, parent="InvoiceDetailOrderInfo", attributes=[
        MalcoXMLAttribute(attribName="orderID", staticVal=None, pyfunc="""str(frappe.db.get_value("Project", inv.project, "commercial_invoice_po_number"))""")
    ]),
    # MalcoXMLElement(tag="DocumentReference", staticVal=None, pyfunc=None, parent="OrderReference", attributes=[
    #     MalcoXMLAttribute(attribName="payloadID", staticVal="XML1138973517001", pyfunc=None)
    # ]),

# Invoice Lines
    MalcoXMLElement(tag="InvoiceDetailItem", staticVal=None, pyfunc=None, parent="InvoiceDetailOrder", attributes=[
        MalcoXMLAttribute(attribName="invoiceLineNumber", staticVal=None, pyfunc="str(line.idx)"),
        MalcoXMLAttribute(attribName="quantity", staticVal=None, pyfunc="str(line.billing_quantity)")
    ], loopPyfunc="invoice_lines(inv.quotation_data)", loopName="invoiceLines"),
    
    MalcoXMLElement(tag="UnitOfMeasure", staticVal="Nos", pyfunc=None, parent="InvoiceDetailItem", attributes=[], loopName="invoiceLines"),
    MalcoXMLElement(tag="UnitPrice", staticVal=None, pyfunc=None, parent="InvoiceDetailItem", attributes=[], loopName="invoiceLines"),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(line.billing_value)", parent="UnitPrice", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ], loopName="invoiceLines"),
    MalcoXMLElement(tag="InvoiceDetailItemReference", staticVal=None, pyfunc=None, parent="InvoiceDetailItem", attributes=[
        MalcoXMLAttribute(attribName="lineNumber", staticVal=None, pyfunc="str(line.idx)"),
    ], loopName="invoiceLines"),
    MalcoXMLElement(tag="Description", staticVal=None, pyfunc="""line.billing_account""", parent="InvoiceDetailItemReference", attributes=[
        MalcoXMLAttribute(attribName="xmllang", staticVal="en-GB", pyfunc=None),
    ], loopName="invoiceLines"),
    MalcoXMLElement(tag="SubtotalAmount", staticVal=None, pyfunc=None, parent="InvoiceDetailItem", attributes=[], loopName="invoiceLines"),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(line.billing_value)", parent="SubtotalAmount", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ], loopName="invoiceLines"),
    MalcoXMLElement(tag="Tax", staticVal=None, pyfunc=None, parent="InvoiceDetailItem", attributes=[], loopName="invoiceLines"),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(line.vat_value)", parent="Tax", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ], loopName="invoiceLines"),
    MalcoXMLElement(tag="NetAmount", staticVal=None, pyfunc=None, parent="InvoiceDetailItem", attributes=[], loopName="invoiceLines"),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(line.total_billing_value)", parent="NetAmount", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ], loopName="invoiceLines"),

# Invoice Lines Ends

    MalcoXMLElement(tag="InvoiceDetailSummary", staticVal=None, pyfunc=None, parent="InvoiceDetailRequest", attributes=[]),
    MalcoXMLElement(tag="SubtotalAmount", staticVal=None, pyfunc=None, parent="InvoiceDetailSummary", attributes=[]),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(inv.total)", parent="SubtotalAmount", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ]),
     MalcoXMLElement(tag="Tax", staticVal=None, pyfunc=None, parent="InvoiceDetailSummary", attributes=[]),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(inv.total_taxes_and_charges)", parent="Tax", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ]),
    MalcoXMLElement(tag="NetAmount", staticVal=None, pyfunc=None, parent="InvoiceDetailSummary", attributes=[]),
    MalcoXMLElement(tag="Money", staticVal=None, pyfunc="str(inv.grand_total)", parent="NetAmount", attributes=[
        MalcoXMLAttribute(attribName="currency", staticVal=None, pyfunc="inv.currency"),
    ]),
]


@frappe.whitelist()
def start_cxml(docname):
    global inv, company_details, company_address, customer_details, customer_address
    inv = frappe.get_doc("Sales Invoice", docname)

    company_details = frappe.get_doc("Company", inv.company)
    company_address = frappe.get_doc("Address", "MalCo - N. Malefakis & Co.-Billing")
    customer_details = frappe.get_doc("Customer", inv.customer)
    customer_address = frappe.get_doc("Address", inv.customer_address)
    
    i=0
    page = None
    doc = None

    for x in invoice_cxml:
        print(i)
        doc = create_xml_tags_recur(x, i, doc)
        i += 1

    # Save to XML file
    outFile = open("cxmls/"+inv.name+'.xml', 'wb')
    doc.write(outFile, xml_declaration=True, encoding='utf-8')
        
# start_xml(invoice_cxml)