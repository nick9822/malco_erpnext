from __future__ import unicode_literals
import frappe, os, copy, json, re
import json
from frappe.desk.form.load import get_attachments

def get_context(context):
        if frappe.session.user == 'Guest': 
	    raise frappe.PermissionError
        context.file_list = get_portal_files("Project", frappe.form_dict.project)
	context.no_cache = 1
	context.show_sidebar = False
	context.docs = qualified_order_list

@frappe.whitelist(allow_guest=True)
def get_projects_hc():
        if frappe.session.user == 'Guest': 
	    raise frappe.PermissionError
        qualified_order_list = []
	order_list = frappe.db.get_list("Project")
	for e in order_list:
            checklist = frappe.db.get_list("Project User", filters={"parent":e.name, "user": frappe.session.user}, fields=["name","parent"], limit_page_length=100)
            if len(checklist) > 0:
                qualified_order_list.append(frappe.db.get("Project", e.name))
	return qualified_order_list


@frappe.whitelist(allow_guest=True)
def get_projects_lc():
        if frappe.session.user == 'Guest': 
	    raise frappe.PermissionError
        qualified_order_list = []
        checklist = frappe.db.get_list("Project User", filters={"user": frappe.session.user}, fields=["name","parent"], limit_page_length=100)
	for e in checklist:
            qualified_order_list.append(frappe.get_doc("Project", e.parent))
	return qualified_order_list

@frappe.whitelist(allow_guest=True)
def get_projects():
        if frappe.session.user == 'Guest': 
	    raise frappe.PermissionError

        proj_list = frappe.db.sql('''select distinct project.*, cntd.*
                        from tabProject as project
                        left join `tabProject User` as project_user on project_user.parent = project.name
                        left join `tabContainer data` as cntd on cntd.parent = project.name
                        where project_user.user = %(user)s and (project.container = 0 or cntd.idx = 1)
                                order by project.date_of_final_delivery_or_dispatch desc
                        ''',{'user':frappe.session.user},
                                as_dict=True)

        return proj_list

def get_portal_files(doctype, name):
        file_list = []  
        for f in get_attachments(doctype, name):
                if f.is_private != 1:
                        if "malco" in f.file_name.lower():
                                pass
                        else:
                                filename = f.file_name
                                #filepath = os.path.abspath(frappe.local.site_path)+"/public"+f.file_url
                                filepath = f.file_url
                                file_list.append({'filename':filename,'filepath':filepath})

        return file_list
