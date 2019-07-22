# -*- coding: utf-8 -*-
# Copyright (c) 2017, GoElite and contributors
# For license information, please see license.txt

from __future__ import unicode_literals

import frappe, os, copy, json, re
from frappe import _

from frappe.model.document import Document
import dropbox, json, requests
import html2text
from time import sleep
from lxml import etree
import HTMLParser

from frappe.modules import get_doc_path
from jinja2 import TemplateNotFound
from frappe.utils import cint, strip_html
from frappe.utils.pdf import get_pdf
from PyPDF2 import PdfFileWriter, PdfFileReader
from frappe.desk.form.load import get_attachments
from frappe.utils.file_manager import save_file, get_files_path

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
        op = etree.tostring(root, pretty_print=True)
        return h.unescape(op)

@frappe.whitelist()
def remove_duplicate_tags_from_xml(project, xml_html):
        projdoc = frappe.get_doc("Project", project)
        html_en = html2text.html2text(xml_html)        
        h = HTMLParser.HTMLParser()
        xmld = h.unescape(html_en).encode('utf8')
        root = etree.fromstring(xmld)
        for crew in root.xpath('.//GOOITEGDS'):
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
        op = etree.tostring(root, pretty_print=True)
        return h.unescape(op)

@frappe.whitelist()
def delete_doc_force(doctype, name):
        res = frappe.delete_doc(doctype, name, force=1)
        return res

@frappe.whitelist()
def complete_dn():
        cdate = frappe.utils.data.nowdate()
        dn_list = frappe.get_list('Delivery Note', filters={'status': "To Bill"}, fields=['name', 'posting_date'], order_by='posting_date')
        for dn in dn_list:
                dn_date = frappe.get_value('Delivery Note', dn.name, 'posting_date')
                if(frappe.utils.data.getdate(dn_date) < frappe.utils.data.getdate(cdate)):
                        doc = frappe.get_doc('Delivery Note', dn.name)
                        #frappe.set_value('Delivery Note', dn.name, 'status', 'Completed')
                        doc.set_status()
                        doc.db_set("per_billed", 100, commit = True)
                        doc.db_set("status", 'Completed', commit = True)
                        doc.save
                        frappe.db.commit()


@frappe.whitelist()
def download_multi_pdf(doctype, name, format=None):

        fname = os.path.join("/tmp", "frappe-pdf-{0}.pdf".format(frappe.generate_hash()))
	# Concatenating pdf files
	output = PdfFileWriter()
	#for i, ss in enumerate(result):
	output = frappe.get_print(doctype, name, format, as_pdf = True, output = output)
	customer = frappe.get_value('Sales Invoice', name, 'customer')
	
	for attach_item in get_attachments(doctype, name):
                if attach_item.is_private == 1:
                        aname = os.path.abspath(frappe.local.site_path)+"/private"+attach_item.file_url
                else:
                        aname = os.path.abspath(frappe.local.site_path)+"/public"+attach_item.file_url                        
                append_pdf(PdfFileReader(file(aname,"rb")),output)

	frappe.local.response.filename = "{doctype}.pdf".format(doctype=doctype.replace(" ", "-").replace("/", "-"))
	frappe.local.response.filecontent = read_multi_pdf(output, doctype, name, customer)
	frappe.local.response.type = "download"

def read_multi_pdf(output, doctype, name, customer):
	# Get the content of the merged pdf files
	mfname = "MalCo_invoice_{0}_for_{1}.pdf".format(name, customer)
	
	fname = os.path.join("/tmp", "frappe-pdf-{0}.pdf".format(frappe.generate_hash()))
	output.write(open(fname,"wb"))

	with open(fname, "rb") as fileobj:
		filedata = fileobj.read()
		
        saved_file = save_file(mfname, filedata, doctype, name, folder="Home/Attachments")
        frappe.db.commit()
	return filedata

def append_pdf(input,output):
	# Merging multiple pdf files
        [output.addPage(input.getPage(page_num)) for page_num in range(input.numPages)]

@frappe.whitelist()
def book_expenses_projects_monthly(date):
        if date:
                pdate = frappe.utils.dateutils.parse_date(date)
                first_day = frappe.utils.get_datetime_str(frappe.utils.get_first_day(pdate)).split(" ")
                last_day = frappe.utils.get_datetime_str(frappe.utils.get_last_day(pdate)).split(" ")
                projects = frappe.db.sql("select name from tabProject where date_of_customs_declaration >= '{0}' and date_of_customs_declaration <= '{1}'".format(first_day[0], last_day[0]),as_dict=1)
                if (len(projects) == 0):
                        frappe.throw("No projects to book expenses")
                else:
                        tc = 0
                        for e in projects:
                                project = frappe.get_doc("Project", e.name)
                                for e in project.cost_analysis:
                                        if e.payment_entry:
                                                if e.billing_account != "Εγγύηση εμπ/τίων - Containers guarantee":
                                                        tc += e.total_billing_value
                        jv = frappe.new_doc("Journal Entry")
                        jv.voucher_type = "Journal Entry"
                        jv.posting_date = last_day[0]
                        jv.cheque_no = last_day[0]
                        jv.cheque_date = last_day[0]
                        jv.append("accounts",{"account":"Project Expenses - MalCo","cost_center":"Main - MalCo","debit_in_account_currency": tc})
                        jv.append("accounts",{"account":"Creditors - MalCo","party_type":"Supplier","party":"Project Expenses","cost_center":"Main - MalCo","credit_in_account_currency": tc})
                        res = jv.insert()
                        jv.submit()
                        frappe.db.commit()
                        frappe.msgprint(res.name)
        else:
                frappe.throw("Please select date")

@frappe.whitelist()
def book_expenses_projects():
        projects = frappe.get_list('Project', filters={'status': ["in", "Completed, Closed"], 'expenses_booked':["=", 0], 'expected_start_date':[">=", "2018/01/01"]}, limit_page_length=20)
        if (len(projects) == 0):
                frappe.throw("No projects to book expenses")
        else:
                for e in projects:
                        book_expenses_project(e.name)
                
@frappe.whitelist()
def book_expenses_project(proj):
        project = frappe.get_doc("Project", proj)
        tc = 0
        for e in project.cost_analysis:
                tc += e.total_billing_value
        jv = frappe.new_doc("Journal Entry")
        jv.voucher_type = "Journal Entry"
        jv.posting_date = frappe.utils.nowdate()
        jv.cheque_no = project.name
        jv.cheque_date = frappe.utils.nowdate()
        jv.project_reference = project.name
        jv.project = project.name
        jv.append("accounts",{"account":"Project Expenses - MalCo","cost_center":"Main - MalCo","debit_in_account_currency": tc})
        jv.append("accounts",{"account":"Creditors - MalCo","party_type":"Supplier","party":"Project Expenses","cost_center":"Main - MalCo","credit_in_account_currency": tc})
        res = jv.insert()
        jv.submit()
        frappe.db.set_value("Project", project.name, "expenses_booked", 1)
        frappe.db.set_value("Project", project.name, "costs_journal_entry", res.name)
        frappe.db.commit()

@frappe.whitelist()
def book_expense_project(proj, tbv, supplier, payment_date):
        jv = frappe.new_doc("Journal Entry")
        jv.voucher_type = "Journal Entry"
        jv.posting_date = payment_date
        jv.cheque_no = proj
        jv.cheque_date = payment_date
        jv.project_reference = proj
        jv.project = proj
        jv.append("accounts",{"account":"Project Expenses - MalCo","cost_center":"Main - MalCo","debit_in_account_currency": tbv})
        jv.append("accounts",{"account":"Creditors - MalCo","party_type":"Supplier","party":supplier,"cost_center":"Main - MalCo","credit_in_account_currency": tbv})
        res = jv.insert()
        jv.submit()
        frappe.db.commit()
        return res.name

@frappe.whitelist()
def book_expense_pe(ref, tbv, party_type, party, payment_date, expense_account):
        jv = frappe.new_doc("Journal Entry")
        jv.voucher_type = "Journal Entry"
        jv.posting_date = payment_date
        jv.cheque_no = ref
        jv.cheque_date = payment_date
        jv.append("accounts",{"account":expense_account,"cost_center":"Main - MalCo","debit_in_account_currency": tbv})
        jv.append("accounts",{"account":"Creditors - MalCo","party_type":party_type,"party":party,"cost_center":"Main - MalCo","credit_in_account_currency": tbv})
        res = jv.insert()
        jv.submit()
        frappe.db.set_value("Payment Entry", ref, "journal_entry", res.name)
        frappe.db.commit()
        return res.name

@frappe.whitelist()
def get_html_from_url(url):
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'})
        return response.text

def book_bck_expense_pe():
        pes = frappe.get_list('Payment Entry', filters={'creation': [">=", "2018-11-22"], 'is_expense':["=", 1], 'journal_entry':["=", ""]}, fields=["name", "paid_amount", "party_type", "party", "posting_date", "expense_account"])
        for e in pes:
                book_expense_pe(e.name, e.paid_amount, e.party_type, e.party, e.posting_date, e.expense_account)

@frappe.whitelist()
def payment_via_journal_entry(document_type, document_name, journal_entry):
        jv = frappe.get_doc("Journal Entry", journal_entry)
        update_doc = frappe.get_doc(document_type, document_name)

        if document_type == "Purchase Invoice" and jv.pay_to_recd_from == update_doc.supplier and jv.total_amount >= update_doc.base_grand_total:
                update_doc.payment_journal_entry = journal_entry
                update_doc.is_paid = 1
                update_doc.outstanding_amount = 0
                update_doc.paid_amount = update_doc.base_grand_total
                update_doc.flags.ignore_validate_update_after_submit = True
                update_doc.save()
                frappe.db.commit()
                return "Success"
        elif document_type == "Sales Invoice" and jv.pay_to_recd_from == update_doc.customer and jv.total_amount >= update_doc.base_grand_total:
                update_doc.payment_journal_entry = journal_entry
                update_doc.is_paid = 1
                update_doc.outstanding_amount = 0
                update_doc.paid_amount = update_doc.base_grand_total
                update_doc.flags.ignore_validate_update_after_submit = True
                update_doc.save()
                frappe.db.commit()
                return "Success"
        else:
                frappe.throw("Journal Entry is not identified with the party or the amount in the Journal Entry is less than document's total. Please check Pay To / Recd From in the Journal Entry")
        