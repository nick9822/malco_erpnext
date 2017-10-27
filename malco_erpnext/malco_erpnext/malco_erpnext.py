# -*- coding: utf-8 -*-
# Copyright (c) 2017, GoElite and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
import dropbox, json
import html2text
from time import sleep
from lxml import etree
import HTMLParser

from frappe.integrations.doctype.dropbox_settings.dropbox_settings import get_dropbox_settings
dropbox_settings = get_dropbox_settings()

local_io_path = frappe.db.get_value("Dropbox Settings", None, "local_io_path")
dropbox_io_path = frappe.db.get_value("Dropbox Settings", None, "dropbox_io_path")

@frappe.whitelist()
def upload_transaction_ts(doctype, docname, pf):
        dropbox_token = frappe.db.get_value("Dropbox Settings", None, "dropbox_access_token")
        local_url = "{0}{1}.txt".format(local_io_path, docname)
        f= open(local_url,"w+")
        html = frappe.get_print(doctype, docname, pf)
        html_en = html2text.html2text(html)
        f.write(html_en.encode('utf-8').strip())
        f.close()
        dbx = dropbox.Dropbox(dropbox_settings['access_token'])
        conn = dbx.users_get_current_account()
        try:
                with open(local_url, "rb") as f:
                        upl = dbx.files_upload(f.read(), '{0}{1}.IN'.format(dropbox_io_path, docname), mute = True)
                sleep(10)
                get_algo_signature(doctype, docname)
        except:
                return "Upload Failed!!! Something went wrong!!!!"

@frappe.whitelist()
def get_algo_signature(doctype, docname):
        dropbox_token = frappe.db.get_value("Dropbox Settings", None, "dropbox_access_token")
        dbx = dropbox.Dropbox(dropbox_settings['access_token'])
        conn = dbx.users_get_current_account()
        try:
                metadata, res = dbx.files_download(path='{0}{1}.OUT'.format(dropbox_io_path, docname))
                frappe.db.set_value(doctype, docname, "algobox_signature", res.content)
                return res.content
        except:
                return "No signature found or Something went wrong!!!!"

def sign_invoice(doc, method):
        cgroup = frappe.db.get_value("Customer", doc.customer, "customer_group")
        if cgroup == "Individual":
                if doc.doctype == "Sales Invoice":
                        upload_transaction_ts(doc.doctype, doc.name, "MalCo Invoice")
                elif doc.doctype == "Delivery Note":
                        upload_transaction_ts(doc.doctype, doc.name, "MalCo Delivery Note")

@frappe.whitelist()
def remove_duplicate_tags(project):
        projdoc = frappe.get_doc("Project", project)
        html_en = html2text.html2text(projdoc.xml_html)        
        h = HTMLParser.HTMLParser()
        xmld = h.unescape(html_en).encode('utf8')
        root = etree.fromstring(xmld)
        for crew in root.xpath('.//GOOITEGDS'):
                i_index = crew.find("IteNumGDS7").text
                if int(i_index) > 1:
                        for rcrew in crew.xpath('.//CONNR2'):
                                rcrew.getparent().remove(rcrew)                        
                hs_code = projdoc.commodities_data[int(i_index)-1].hs_code
                for ccrew in crew.xpath('.//PRODOCDC2'):
                        vdoc = ccrew.find("DocTypDC21").text
                        for e in projdoc.customs_attachments:
                                if e.document_code == vdoc:
                                        if e.hs_code != hs_code:
                                                ccrew.getparent().remove(ccrew)
                                                break
                for ccrew in crew.xpath('.//CALTAXGOD'):
                        vdoc = ccrew.find("TypOfTaxCTX1").text
                        for e in projdoc.customs_duties_analysis:
                                if e.customs_charges_code == vdoc:
                                        if e.hs_code != hs_code:
                                                ccrew.getparent().remove(ccrew)
                                                break
        return etree.tostring(root, pretty_print=True)                        
