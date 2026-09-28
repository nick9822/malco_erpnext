# -*- coding: utf-8 -*-
# Copyright (c) 2017, GoElite and contributors
# For license information, please see license.txt

from __future__ import unicode_literals

import frappe, os, copy, json, re
from frappe import _
import io

from frappe.model.document import Document
import dropbox, json, requests
import html2text
from time import sleep
from lxml import etree
import HTMLParser
import shutil

from frappe.modules import get_doc_path
from jinja2 import TemplateNotFound
from frappe.utils import cint, strip_html, flt
from frappe.utils.pdf import get_pdf
from PyPDF2 import PdfFileWriter, PdfFileReader
from frappe.desk.form.load import get_attachments
from frappe.utils.file_manager import save_file, get_files_path

from frappe.integrations.doctype.dropbox_settings.dropbox_settings import get_dropbox_settings
from cdt_xml import CdtXML
from xml.etree import ElementTree
from frappe.utils.file_manager import save_url
import qrcode

dropbox_settings = get_dropbox_settings()

local_io_path = frappe.db.get_value("Dropbox Settings", None, "local_io_path")
dropbox_io_path = frappe.db.get_value("Dropbox Settings", None, "dropbox_io_path")

@frappe.whitelist()
def upload_transaction_ts(doctype, docname, pf):
        return "Disabled"
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
        return "Disabled"
        dropbox_token = frappe.db.get_value("Dropbox Settings", None, "dropbox_access_token")
        dbx = dropbox.Dropbox(dropbox_settings['access_token'])
        conn = dbx.users_get_current_account()
        try:
                metadata, res = dbx.files_download(path='{0}{1}.OUT'.format(dropbox_io_path, docname))
                frappe.db.set_value(doctype, docname, "algobox_signature", res.content)
                frappe.db.commit()
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

# @frappe.whitelist()
# def remove_duplicate_tags(project):
#         projdoc = frappe.get_doc("Project", project)
#         html_en = html2text.html2text(projdoc.xml_html)        
#         h = HTMLParser.HTMLParser()
#         xmld = h.unescape(html_en).encode('utf8')
#         root = etree.fromstring(xmld)
#         for crew in root.xpath('.//GOOITEGDS'):
#                 i_index = crew.find("IteNumGDS7").text
#                 if int(i_index) > 1:
#                         for rcrew in crew.xpath('.//CONNR2'):
#                                 rcrew.getparent().remove(rcrew)
#                         for rcrew in crew.xpath('.//TAXADDELE100'):
#                                 rcrew.getparent().remove(rcrew)
#                 hs_code = projdoc.commodities_data[int(i_index)-1].hs_code
#                 for idx, ccrew in enumerate(crew.xpath('.//PRODOCDC2')):
#                         score = 0
#                         vdoc = ccrew.find("DocTypDC21").text
#                         for idxx, e in enumerate(projdoc.customs_attachments):
#                                 if e.document_code == vdoc and e.hs_code == hs_code and idx == idxx:
#                                         score = score + 1
#                         if score == 0:
#                                 ccrew.getparent().remove(ccrew)
#                 for idx, ccrew in enumerate(crew.xpath('.//CALTAXGOD')):
#                         score = 0
#                         vdoc = ccrew.find("TypOfTaxCTX1").text
#                         for idxx, e in enumerate(projdoc.customs_duties_analysis):
#                                 if e.customs_charges_code == vdoc and e.hs_code == hs_code and idx == idxx:
#                                         score = score + 1
#                         if score == 0:
#                                 ccrew.getparent().remove(ccrew)
#         op = etree.tostring(root, pretty_print=True)
#         return h.unescape(op)

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
        
@frappe.whitelist()
def mark_invoice_as_paid(document_type, document_name):
        update_doc = frappe.get_doc(document_type, document_name)

        if document_type == "Purchase Invoice" and update_doc.outstanding_amount > 0:
                update_doc.is_paid = 1
                update_doc.outstanding_amount = 0
                update_doc.paid_amount = update_doc.base_grand_total
                update_doc.flags.ignore_validate_update_after_submit = True
                update_doc.save()
                frappe.db.commit()
                return "Success"
        elif document_type == "Sales Invoice" and update_doc.outstanding_amount > 0:
                update_doc.is_paid = 1
                update_doc.outstanding_amount = 0
                update_doc.paid_amount = update_doc.base_grand_total
                update_doc.flags.ignore_validate_update_after_submit = True
                update_doc.save()
                frappe.db.commit()
                return "Success"
        else:
                frappe.throw("Outstanding amount should be greater than zero")

@frappe.whitelist()
def override_pe_get_employee_details():
        from erpnext.hr.doctype.payroll_entry.payroll_entry import PayrollEntry
        PayrollEntry.get_emp_list = ord_get_emp_list
        return "Overriden"

def ord_get_emp_list(self):
        """
                Returns list of active employees based on selected criteria
                and for which salary structure exists
        """
        cond = self.get_filter_condition()
        cond += self.get_joining_releiving_condition()

        condition = ''
        if self.payroll_frequency:
                condition = """and payroll_frequency = '%(payroll_frequency)s'"""% {"payroll_frequency": self.payroll_frequency}

        sal_condition = ""

        if self.salary_structure:
                sal_condition = "name='{0}' and ".format(self.salary_structure)

        sal_struct = frappe.db.sql("""
                        select
                                name from `tabSalary Structure`
                        where
                                {sal_condition}
                                docstatus != 2 and
                                is_active = 'Yes'
                                and company = %(company)s and
                                ifnull(salary_slip_based_on_timesheet,0) = %(salary_slip_based_on_timesheet)s
                                {condition}""".format(condition=condition, sal_condition=sal_condition),
                                {"company": self.company, "salary_slip_based_on_timesheet":self.salary_slip_based_on_timesheet})

        if sal_struct:
                cond += "and t2.parent IN %(sal_struct)s "
                emp_list = frappe.db.sql("""
                        select
                                t1.name as employee, t1.employee_name, t1.department, t1.designation
                        from
                                `tabEmployee` t1, `tabSalary Structure Employee` t2
                        where
                                t1.docstatus!=2
                                and t1.name = t2.employee
                %s """% cond, {"sal_struct": sal_struct}, as_dict=True)
                return emp_list

def return_invoice(doctype, name):
        if doctype == "Sales Invoice":
                from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_sales_return
                docsin = make_sales_return(name)
                docsin.naming_series = "RCPT-RET-"
                docsin.submit()
                frappe.db.commit()
        elif doctype == "Delivery Note":
                from erpnext.stock.doctype.delivery_note.delivery_note import make_sales_return
                docsin = make_sales_return(name)
                docsin.submit()
                frappe.db.commit()

def close_open_siv_so():
        pending_so = frappe.get_list("Sales Order", filters=[["status", "in", ["To Deliver and Bill", "To Bill",  "To Deliver"]]])
        pending_sinv = frappe.get_list("Sales Invoice", filters=[["status", "in", ["Unpaid", "Overdue"]]])

        for e in pending_so:
                if frappe.db.get_value("Project", e.project_reference, "erp_status") == "Closed":
                        frappe.db.set_value("Sales Order", e.name, "status", "Closed")
                        return e.name, "Closed"

        for e in pending_sinv:
                if frappe.db.get_value("Project", e.project_reference, "erp_status") == "Closed":
                        mark_invoice_as_paid("Sales Invoice", e.name)
                        return e.name, "Paid"
        
        frappe.db.commit()

@frappe.whitelist()
def create_file_to_sign_frm_json(doc, method, recreate=0):
        # VAT (issuer) ; Invoice Series ;  Invoice No. ; Date (yyyy-mm-dd) ; Customer VAT number ; Customer Name ; Customer Address ; 
        # Customer City ;  Customer Post Code ; Office Payment (only our payment in euro e.g. 200.00) ; 
        # VAT (Vat for our payment only e.g. 48.00) ; Total of all other expenses.
        docJson = json.loads(doc)
        doc = frappe._dict(docJson)

        if doc.mydata_infile_created == 1 and recreate == 0:
                frappe.msgprint("MyData file is already created")
                return

        cgroup = frappe.db.get_value("Customer", doc.customer, "customer_group")
        if cgroup == "Individual":
                frappe.msgprint("This MyData function is not applicable for Individual customer")
                return
        
        company_vat_id = frappe.db.get_value("Company", doc.company, "tax_id")
        customer_tax_id = frappe.db.get_value("Customer", doc.customer, "tax_id")
        customer_address = frappe.get_doc("Address", doc.customer_address)

        fee = 0
        vat = 0
        total_other_exp = 0
        for e in doc.quotation_data:
                e = frappe._dict(e)
                if e.billing_account == "Παροχή Υπηρεσιών - Customs clearance fees" or e.billing_account == "Επιστροφή εισφορών ΕΕΠΑ":
                        fee += e.billing_value
                        vat += e.vat_value
                else: 
                        total_other_exp += e.total_billing_value


        strwr = company_vat_id+";"+doc.naming_series+";"+doc.name+";"+str(doc.posting_date)+";"+customer_tax_id+";"+doc.customer_name+";"
        strwr += (customer_address.address_line1 or "" ) + ";"+ (customer_address.city or "") +";"+ (customer_address.pincode or "") +";"
        strwr += str(fee)+";"+str(vat)+";"+str(total_other_exp)+";"

        with open("invoices_for_komvos_sign/"+doc.name+".txt", 'w') as f:
                f.write(strwr.encode('utf-8'))
        
        frappe.db.set_value("Sales Invoice", doc.name, "mydata_infile_created", 1)
        frappe.db.commit()
        frappe.msgprint("MyData file is created")

@frappe.whitelist()
def create_file_to_sign(doc, method):
        if doc.mydata_result == "OK":
                return
        
        cgroup = frappe.db.get_value("Customer", doc.customer, "customer_group")
        if cgroup == "Individual":
                return
        
        # VAT (issuer) ; Invoice Series ;  Invoice No. ; Date (yyyy-mm-dd) ; Customer VAT number ; Customer Name ; Customer Address ; 
        # Customer City ;  Customer Post Code ; Office Payment (only our payment in euro e.g. 200.00) ; 
        # VAT (Vat for our payment only e.g. 48.00) ; Total of all other expenses.
        company_vat_id = frappe.db.get_value("Company", doc.company, "tax_id")
        customer_tax_id = frappe.db.get_value("Customer", doc.customer, "tax_id")
        customer_address = frappe.get_doc("Address", doc.customer_address)

        fee = 0
        vat = 0
        total_other_exp = 0
        for e in doc.quotation_data:
                if e.billing_account == "Παροχή Υπηρεσιών - Customs clearance fees" or e.billing_account == "Επιστροφή εισφορών ΕΕΠΑ":
                        fee += e.billing_value
                        vat += e.vat_value
                else: 
                        total_other_exp += e.total_billing_value


        strwr = company_vat_id+";"+doc.naming_series+";"+doc.name+";"+str(doc.posting_date)+";"+customer_tax_id+";"+doc.customer_name+";"
        strwr += (customer_address.address_line1 or "" ) + ";"+ (customer_address.city or "") +";"+ (customer_address.pincode or "") +";"
        strwr += str(fee)+";"+str(vat)+";"+str(total_other_exp)+";"

        if doc.is_return:
                return_invoice = frappe.get_doc("Sales Invoice", doc.return_against)
                if not return_invoice.mydata_official_mark_number or not return_invoice.mydata_evresis_id:
                        frappe.throw("Original invoice doesn't have MyData attributes, contact Administrator.") 
                strwr += return_invoice.mydata_official_mark_number+";"+return_invoice.mydata_evresis_id+";"

        with open("invoices_for_komvos_sign/"+doc.name+".txt", 'w') as f:
                f.write(strwr.encode('utf-8'))
        
        frappe.db.set_value("Sales Invoice", doc.name, "mydata_infile_created", 1)
        frappe.db.commit()
        frappe.msgprint("MyData file is created")

@frappe.whitelist()
def create_cancellation_file_to_sign(doc, method):
        if doc.mydata_result != "OK" and doc.mydata_result != "ERROR":
                frappe.throw("Can not cancel the invoice. MyData processing awaited.")
                return

        if doc.docstatus == 2:
                if not doc.mydata_official_mark_number:
                        return

                company_vat_id = frappe.db.get_value("Company", doc.company, "tax_id")
                customer_tax_id = frappe.db.get_value("Customer", doc.customer, "tax_id")
                customer_address = frappe.get_doc("Address", doc.customer_address)

                fee = 0
                vat = 0
                total_other_exp = 0
                for e in doc.quotation_data:
                        if e.billing_account == "Παροχή Υπηρεσιών - Customs clearance fees" or e.billing_account == "Επιστροφή εισφορών ΕΕΠΑ":
                                fee += e.billing_value
                                vat += e.vat_value
                        else: 
                                total_other_exp += e.total_billing_value


                strwr = company_vat_id+";"+doc.naming_series+";"+doc.name+";"+str(doc.posting_date)+";"+customer_tax_id+";"+doc.customer_name+";"
                strwr += (customer_address.address_line1 or "" ) + ";"+ (customer_address.city or "") +";"+ (customer_address.pincode or "") +";"
                strwr += str(fee)+";"+str(vat)+";"+str(total_other_exp)+";"
                
                strwr += str(doc.mydata_official_mark_number)+";"
                strwr += str(doc.mydata_evresis_id)

                with open("invoices_for_komvos_sign/"+doc.name+"-C.txt", 'w') as f:
                        f.write(strwr.encode('utf-8'))

                frappe.msgprint("MyData Cancellation file is created")

@frappe.whitelist()
def parse_komvas_output_files():
        # return
        path = "/home/frappe/frappe-bench/sites/invoices_for_komvos_sign_output/"
        xml_path = "/home/frappe/frappe-bench/sites/invoices_for_komvos_sign_output/xmls"
        processed_path = "/home/frappe/frappe-bench/sites/invoices_for_komvos_sign_output/success"
        processed_error_path = "/home/frappe/frappe-bench/sites/invoices_for_komvos_sign_output/errors"

        for file in os.listdir(path):
                os.chdir(path)
                if file.endswith(".txt") and os.path.isfile(file):
                        file_path = path + "/"+ file

                        inv_name = file.split("_")[0]
                        inv = frappe.get_doc("Sales Invoice", inv_name)
                        if inv.mydata_result != "OK" and inv.docstatus == 1:
                                output = read_text_file(file_path)
                                output_arr = output.strip().split()
                                if len(output_arr) > 0:
                                        if output_arr[0] == "OK":
                                                print(output)
                                                print(inv_name)
                                                inv.mydata_result = "OK"
                                                inv.mydata_evresis_id = output_arr[2]
                                                inv.mydata_official_mark_number = output_arr[3]
                                                inv.mydata_uid_number = output_arr[4]
                                                if len(output_arr)==6 and output_arr[5]:
                                                        inv.mydata_qr_link = output_arr[5]
                                                inv.save()
                                                frappe.db.commit()
                                                shutil.move(file_path, processed_path+ "/"+ file)
                                                if len(output_arr)==6 and output_arr[5]:
                                                        print(inv.name, output_arr[5])
                                                        create_attach_qr_image(inv.name, output_arr[5])
                                        elif output_arr[0] == "ERROR":
                                                inv.mydata_result = "ERROR"
                                                inv.mydata_error = output.strip()
                                                inv.save()
                                                frappe.db.commit()
                                                shutil.move(file_path, processed_error_path+ "/"+ file)
                        elif inv.docstatus == 2:
                                c_check = file.split("-")
                                print(c_check)
                                if len(c_check) > 1:
                                        if c_check[1] == "C.txt":
                                                output = read_text_file(file_path)
                                                output_arr = output.strip().split()
                                                if len(output_arr) > 0:
                                                        if output_arr[0] == "OK":
                                                                # update cancelled invoice
                                                                cancel_mark = output_arr[1]
                                                                frappe.db.sql("Update `tabSales Invoice` set mydata_cancellation_mark='{0}' where name='{1}'".format(cancel_mark, inv.name))
                                                                frappe.db.commit()
                                                                shutil.move(file_path, processed_path+ "/"+ file)
                                                        else:
                                                                shutil.move(file_path, processed_error_path+ "/"+ file)

                        else:
                                shutil.move(file_path, processed_error_path+ "/"+ file)
                                print("Skipped "+inv_name)
                elif os.path.isfile(file):
                        print(path)
                        print(xml_path)
                        shutil.move(path + "/"+ file, xml_path+ "/"+ file)  

def read_text_file(file_path):
    with io.open(file_path, 'r', encoding="ISO-8859-7") as f:
        return f.read()

# @frappe.whitelist()
# def create_xml_file_for_komvos(proj):
#         project = frappe.get_doc("Project", proj)
#         if project.xml_html and project.xml_html != "":
#                 html_en = html2text.html2text(project.xml_html)        
#                 h = HTMLParser.HTMLParser()
#                 xmld = h.unescape(html_en).encode('utf8')
#                 with open("xmls_for_komvos_processing/"+project.name+".xml", 'w') as f:
#                         f.write(xmld)
#                 frappe.msgprint("XML file created for Komvos processing.")
#         else:
#                 frappe.msgprint("XML data is blank, please create xml first.")

@frappe.whitelist()
def compare_with_past_expenses(proj):
        project = frappe.get_doc("Project", proj)
        sql = """select 
                        ia.parent, ia.billing_account, ia.billing_value 
                from `tabInvoice analysis` ia 
                left join `tabProject` proj on proj.name = ia.parent 
                where 
                        ia.billing_account IN ('Έκτακτες δαπάνες εντός Τελωνείου - Customs procedures expenses', 'Παροχή Υπηρεσιών - Customs clearance fees') and 
                        proj.customer = '{0}' and 
                        proj.house_master = '{1}' and
                        proj.country_of_import_or_export = '{2}' and
                        proj.customs_authorities_of_declaration = '{3}'
                order by proj.creation desc
                limit 10
        """.format(project.customer, project.house_master, project.country_of_import_or_export, project.customs_authorities_of_declaration)
        res = frappe.db.sql(sql,as_dict=1)
        return res

@frappe.whitelist()
def copy_xml_structure(copyFrom, copyTo):
        fromDoc = frappe.get_doc("Customs Document Type", copyFrom)
        toDoc = frappe.get_doc("Customs Document Type", copyTo)
        for e in fromDoc.xml_structure:
                cdict = e.as_dict()
                del cdict["creation"]
                del cdict["docstatus"]
                del cdict["modified"]
                del cdict["modified_by"]
                del cdict["name"]
                del cdict["owner"]
                del cdict["parent"]
                del cdict["parentfield"]
                del cdict["parenttype"]
                toDoc.append("xml_structure",cdict)
        toDoc.save()
        frappe.db.commit()
        return "OK"

@frappe.whitelist()
def create_xml_file(projname, counter):
        x = CdtXML(projname)
        xml_html = x.startXml()
        frappe.db.set_value("Project", projname, "xml_counter", counter)
        create_xml_file_for_komvos_obj(projname, xml_html)
        return xml_html

@frappe.whitelist()
def create_xml_file_locally(projname, counter):
        x = CdtXML(projname)
        xml_html = x.startXml()
        frappe.db.set_value("Project", projname, "xml_counter", counter)
        return xml_html

def create_xml_file_for_komvos_obj(projname, xml_html):
        # html_en = html2text.html2text(xml_html)        
        # h = HTMLParser.HTMLParser()
        # xmld = h.unescape(html_en).encode('utf8')
        with open("xmls_for_komvos_processing/"+projname+".xml", 'w') as f:
                f.write(xml_html)
        frappe.msgprint("XML file created for Komvos processing.")


@frappe.whitelist()
def ci_invoice_after_submit_actions(docname):
        si = frappe.get_doc("Sales Invoice", docname)
        for e in si.project_reference_list:
                proj = frappe.get_doc("Project", e.project_reference)
                proj.invoice_no = docname
                proj.status = "Invoice Confirmed"
                proj.save()
        frappe.db.commit()

@frappe.whitelist()
def ci_invoice_after_cancel_actions(docname):
        si = frappe.get_doc("Sales Invoice", docname)
        for e in si.project_reference_list:
                proj = frappe.get_doc("Project", e.project_reference)
                proj.invoice_no = ""
                proj.status = "Under Invoicing"
                proj.save()
        frappe.db.commit()

@frappe.whitelist()
def ci_invoice_after_email_actions(docname):
        si = frappe.get_doc("Sales Invoice", docname)
        for e in si.project_reference_list:
                proj = frappe.get_doc("Project", e.project_reference)
                if proj.status != "Closed":
                        proj.status = "Closed"
                        proj.save()
        frappe.db.commit()


def read_xml_file(file_path):
        tree = ElementTree.parse(file_path)
        print(tree)
        # root = tree.getroot()
        # crew = tree.xpath('.//response')[0]
        res_dict = {}
        res = tree.find('response')
        if res:
                res_dict["lrn"] = res.find('lrn').text
                res_dict["mrn"] = res.find('mrn').text
                res_dict["status"] = res.find('status').text
                if res.find('status').text in ("Rejected", "xmlError", "techError"):
                        reasons = res.find("reasonList").findall("reason")
                        reasons = [r.text for r in reasons]
                        reasons = [res.find('status').text + " Reasons:"] + reasons
                        reasonsStr = "\n".join(reasons)
                        res_dict["error"] = reasonsStr
        return res_dict


@frappe.whitelist()
def parse_icis_output_xml_files():
        path = "/home/frappe/frappe-bench/sites/output_xml"
        processed_path = "/home/frappe/frappe-bench/sites/output_xml/success"
        processed_error_path = "/home/frappe/frappe-bench/sites/output_xml/errors"

        for file in os.listdir(path):
                os.chdir(path)
                if file.endswith(".xml") and os.path.isfile(file):
                        file_path = path + "/"+ file
                        print(file_path)
                        proj_name = file.split("-")[0]
                        try:
                                proj = frappe.get_doc("Project", proj_name)
                                output = read_xml_file(file_path)
                                print(output)
                                if output.get("error"):
                                        proj.rejection_reason = output.get["error"]
                                        shutil.move(file_path, processed_error_path+ "/"+ file)
                                        return
                                if output.get("lrn"):
                                        proj.mrn = output["mrn"]
                                        proj.icisnet_status = output["status"]
                                        proj.save()
                                        frappe.db.commit()
                                        shutil.move(file_path, processed_path+ "/"+ file)
                                else:
                                        print("skipped the file "+file_path)
                                        shutil.move(file_path, processed_error_path+ "/"+ file)        
                        except Exception as e:
                                print(e)
                                shutil.move(file_path, processed_error_path+ "/"+ file)

@frappe.whitelist()
def move_icis_files_to_projects():
        path = "/home/frappe/frappe-bench/sites/output_pdf"
        move_path = "/home/frappe/frappe-bench/sites/malco.gr/public/files"

        for file in os.listdir(path):
                os.chdir(path)
                if file.endswith(".pdf") and os.path.isfile(file):
                        file_path = path + "/"+ file
                        print(file_path)
                        proj_name = file.split("-")[0]
                        try:
                                shutil.move(file_path, move_path+ "/"+ file)
                                save_url("https://malco.gr/files/"+file, file, "Project", proj_name, "Home/Attachments", False)
                                frappe.db.commit()
                        except Exception as e:
                                print(e)


@frappe.whitelist()
def copy_files_to_icisnet(files, mrn):
        copy_path = "/home/frappe/frappe-bench/sites/upload_icisnet/"
        public_path = "/home/frappe/frappe-bench/sites/malco.gr/public"
        private_path = "/home/frappe/frappe-bench/sites/malco.gr/private"
        files  = json.loads(files)

        for e in files:
                file = frappe.get_doc("File", e)
                path_to_look = public_path
                if file.is_private == 1:
                        path_to_look = private_path
                
                # raise ValueError(path_to_look+file.file_url, copy_path+file.attached_to_name+"-"+file.file_name)
                try:
                        shutil.copy(path_to_look+file.file_url, copy_path+file.attached_to_name+"-"+mrn+"-"+file.file_name)
                except Exception as x:
                        raise ValueError(path_to_look, file.file_url)
                        print(x)

@frappe.whitelist()
def proj_calculate(doc, method):
        cost_total, invoice_total, billing_cost_total, billing_invoice_total, billing_final_total = 0, 0, 0, 0, 0

        for e in doc.cost_analysis:
                if e.container_guarantee != 1:
                        cost_total += flt(e.total_billing_value)
                        billing_cost_total += flt(e.billing_value)

        for e in doc.invoice_analysis:
                invoice_total += flt(e.total_billing_value)
                billing_invoice_total += flt(e.billing_value)

        final_total = invoice_total - cost_total
        billing_final_total = billing_invoice_total - billing_cost_total

        doc.final_outcome = billing_final_total
        doc.total_cost_value = cost_total
        doc.total_billing_value = invoice_total
        doc.total_outstanding_payment = invoice_total

@frappe.whitelist()
def create_payment_xml_file(projname):
        mrn = frappe.db.get_value("Project", projname, "mrn")
        xml_str = """<?xml version='1.0' encoding='utf-8'?>
        <paymentXml>
                <mrn>{0}</mrn>
                <payment>yes</payment>
        </paymentXml>
        """.format(mrn)
        with open("payment_xmls/"+projname+"-"+str(mrn)+".xml", 'w') as f:
                f.write(xml_str)
                frappe.db.set_value("Project", projname, "proceed_with_icisnet_payment", 1)
        frappe.db.commit()


def create_attach_qr_image(invname, link):
        try:
                mfname = "{0}_QR.png".format(invname)

                fname = os.path.join("/tmp", "frappe-inv-qr-{0}.png".format(frappe.generate_hash()))

                img = qrcode.make(link)
                img.save(fname)

                filedata = ""
                # print("Current working directory:", os.getcwd())
                
                os.chdir("/home/frappe/frappe-bench/sites")
                # print("Current working directory:", os.getcwd())
                with open(fname, "rb") as fileobj:
                        filedata = fileobj.read()
                        
                saved_file = save_file(mfname, filedata, "Sales Invoice", invname, folder="Home/Attachments")
                print(saved_file.name)
                frappe.db.commit()
        except Exception as e:
                frappe.log_error(title="Invoice QR Creation Error", message=frappe.get_traceback())

@frappe.whitelist()
def mark_pre_payment(project):
        pre_status_list = ['Imported by Kovmos', 'Under Quotation', 'Expecting Documents', 'ETA or ETD']
        if frappe.db.get_value("Project", project, "status") in pre_status_list:
                frappe.db.set_value("Project", project, "pre_payment_inspection", 1)
                frappe.db.commit()
        else:
                frappe.throw("Project is not in the correct state to select pre payment inspection.")

@frappe.whitelist()
def cancel_mark_pre_payment(project):
        cancel_pre_status_list = ['Imported by Kovmos', 'Under Quotation', 'Expecting Documents', 'ETA or ETD']
        if frappe.db.get_value("Project", project, "status") in cancel_pre_status_list:
                frappe.db.set_value("Project", project, "pre_payment_inspection", 0)
                frappe.db.commit()
        else:
                frappe.throw("Project is not in the correct state to cancel pre payment inspection.")