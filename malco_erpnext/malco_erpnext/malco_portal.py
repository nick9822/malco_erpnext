# ruff: noqa: UP009, UP032, UP025
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
import json
from frappe.utils.formatters import format_value
from frappe.desk.form.load import get_attachments


"""
ASSUMTIONS: Weights are always expressed in KGs.
"""

ALL_PORTAL_STATUSES = [
    "Under Quotation",
    "Expecting Documents",
    "Open",
    "Under Examination",
    "ETA or ETD",
    "Expecting Bank Transfer",
    "Expecting Delivery Order or Data",
    "Under Pre payment Inspection",
    "Before ICISnet Progress",
    "Under ICISnet Progress",
    "Under Customs Control",
    "Under Balance Payment",
    "Under Delivery",
    "Under Destruction",
    "Completed",
    "Under Invoicing",
    "Invoice Confirmed",
    "QR Code Under Process",
    "Closed",
    "Import not Allowed",
]

DEFAULT_STATUSES = [
    "Under Quotation",
    "Expecting Documents",
    "Open",
    "Under Examination",
    "ETA or ETD",
    "Expecting Bank Transfer",
    "Expecting Delivery Order or Data",
    "Under Pre payment Inspection",
    "Before ICISnet Progress",
    "Under ICISnet Progress",
    "Under Customs Control",
    "Under Balance Payment",
    "Under Delivery",
    "Under Destruction",
    "Completed",
    "Under Invoicing",
    "Invoice Confirmed",
    "QR Code Under Process",
    "Closed",
    "Import not Allowed",
]

DEFAULT_LIST_STATUSES = [
    "Under Quotation",
    "Expecting Documents",
    "Open",
    "Under Examination",
    "ETA or ETD",
    "Expecting Bank Transfer",
    "Expecting Delivery Order or Data",
    "Under Pre payment Inspection",
    "Before ICISnet Progress",
    "Under ICISnet Progress",
    "Under Customs Control",
    "Under Balance Payment",
    "Under Delivery",
    "Under Destruction",
    "Completed",
    "Under Invoicing",
    "Invoice Confirmed",
    "QR Code Under Process",
    "Import not Allowed",
]

"""
5	ΔΙΑ ΑΓΩΓΟΥ - ΣΤΑΘΕΡΕΣ ΕΓΚΑΤΑΣΤΑΣΕΙΣ
1	ΑΤΜΟΠΛΟΙΚΩΣ
2	ΣΙΔΗΡΟΔΡΟΜΙΚΩΣ
3	ΟΔΙΚΩΣ
4	ΑΕΡΟΠΟΡΙΚΩΣ
7	ΔΙΑ ΑΓΩΓΟΥ - ΣΤΑΘΕΡΕΣ ΕΓΚΑΤΑΣΤΑΣΕΙΣ
9	ΑΥΤΟΦΕΡΟΜΕΝΑ
12	ΒΑΓΟΝΙ ΣΕ ΠΛΟΙΟ
16	ΟΔΙΚΩΣ ΜΕ ΧΡΗΣΗ ΠΛΟΙΟΥ
17	ΡΥΜΟΥΛΚΟΥΜΕΝΟ ΜΕΣΑ ΣΕ ΠΛΟΙΟ
18	ΠΛΟΙΟ ΕΣ.ΝΑΥΣ. ΜΕΣΑ ΣΕ ΠΛΟΙΟ

5	PIPELINE - FIXED INSTALLATIONS
1	BY SEA
2	BY RAIL
3	BY ROAD
4	BY AIR
7	PIPELINE - FIXED INSTALLATIONS
9	SELF-PROPELLED
12	RAIL WAGON ON BOARD A SHIP
16	ROAD TRANSPORT INVOLVING A SHIP
17	TRAILER ON BOARD A SHIP
18	INLAND WATERWAY VESSEL ON BOARD A SHIP
"""

MOT_MAP = {
    "5": "PIPELINE",
    "1": "SHIP",
    "2": "RAIL",
    "3": "ROAD",
    "4": "AIR",
    "7": "PIPELINE",
    "9": "SELF-PROPELLED",
    "12": "SHIP",
    "16": "SHIP",
    "17": "SHIP",
    "18": "SHIP",
}

PRE_STATUS_LIST = [
    "Imported by Kovmos",
    "Under Quotation",
    "Expecting Documents",
    "ETA or ETD",
]
CANCEL_PRE_STATUS_LIST = [
    "Imported by Kovmos",
    "Under Quotation",
    "Expecting Documents",
    "ETA or ETD",
]


PRIVILEGED_USERS = ["Administrator", "erpnext@malco.gr", "nmalefakis@malco.gr"]


def serialize_container(container):
    return {
        "number": container.container_number,
        "size": container.container_size or "",
        "seal": container.container_seal or "",
        "malcoSeal": container.malco_seal or "",
        "lot": container.lot_number or "",
    }


def serialize_commodity(commodity):
    return {
        "packaging": commodity.packaging or "",
        "items": format_value(commodity.items) if commodity.items else 0.00,
        "hsCode": "{} / {}".format(
            commodity.hs_code_commercial_name_gr or "",
            commodity.hs_code_commercial_name_en or "",
        ),
        "gross": "{} Kgs".format(format_value(commodity.gross_weight))
        if commodity.gross_weight
        else "-",
        "net": "{} Kgs".format(format_value(commodity.net_weight))
        if commodity.net_weight
        else "-",
    }


def serialize_attachment(attachment):
    return {
        "file_name": attachment.file_name,
        "url": attachment.file_url,
        "id": attachment.name,
    }


@frappe.whitelist()
def get_privileged_users():
    return PRIVILEGED_USERS


@frappe.whitelist()
def is_session_privileged():
    return frappe.session.user in PRIVILEGED_USERS


@frappe.whitelist()
def get_project(docname):
    proj = frappe.get_doc("Project", docname)

    user_authorized = False

    if frappe.session.user in PRIVILEGED_USERS:
        user_authorized = True

    if not user_authorized:
        for e in proj.users:
            if e.user == frappe.session.user:
                user_authorized = True
                break

    if not user_authorized:
        raise frappe.AuthenticationError

    pd_address = frappe.get_doc("Address", proj.physical_delivery)
    pd_address_str = ""
    if pd_address:
        if pd_address.address_title:
            pd_address_str += pd_address.address_title

        if pd_address.address_line1:
            pd_address_str += "\n"
            pd_address_str += pd_address.address_line1

        if pd_address.address_line2:
            pd_address_str += "\n"
            pd_address_str += pd_address.address_line2

        if pd_address.city:
            pd_address_str += "\n"
            pd_address_str += pd_address.city

        if pd_address.county:
            pd_address_str += "\n"
            pd_address_str += pd_address.county

        if pd_address.state:
            pd_address_str += "\n"
            pd_address_str += pd_address.state

        if pd_address.country:
            pd_address_str += "\n"
            pd_address_str += pd_address.country

        if pd_address.pincode:
            pd_address_str += "\n"
            pd_address_str += pd_address.pincode

    proj_res_object = {
        "id": proj.name,
        "status": proj.status,
        "prePaymentInspection": proj.pre_payment_inspection == 1,
        "basic": {
            "mrn": proj.mrn or "",
            "customsDocType": proj.customs_document_type,
            "houseOrMaster": proj.house_master or "",
            "oceanForwarder": proj.ocean_forwarder or "",
            "localForwarder": proj.local_forwarder or "",
            "physicalDelivery": pd_address_str,
            "invoicedToPayer": proj.invoiced_to_payer or "",
            "internalCompanyCode": proj.internal_company_code or "",
        },
        "transport": {
            "countryImportExport": proj.country_of_import_or_export or "",
            "countryFinalDestination": proj.country_of_final_destination or "",
            "masterBolOrCmr": proj.master_bol_or_cmr or "",
            "customsWarehouse": proj.customs_warehouse or "",
            "externalMeansOfTransport": proj.external_means_of_transport or "",
            "externalMeansOfTransportCode": proj.external_means_of_transport_code or "",
        },
        "containers": [
            serialize_container(container) for container in proj.container_data
        ],
        "commodities": [
            serialize_commodity(commodity) for commodity in proj.commodities_data
        ],
        "schedule": {
            "docsReceipt": proj.get_formatted("date_of_documents_receipt") or "",
            "customsDeclaration": proj.get_formatted("date_of_customs_declaration")
            or "",
            "etaEtdLoading": proj.get_formatted("eta_or_etd") or "",
            "finalDelivery": proj.get_formatted("date_of_final_delivery_or_dispatch")
            or "",
            "freeDemurrageDays": proj.days_of_free_demurrage_ or 0,
            "lastFreeDay": proj.get_formatted("last_day_of_free_demurrage") or "",
        },
        "commercial": {
            "invoiceNumber": proj.commercial_invoice_number,
            "invoiceDate": proj.get_formatted("commercial_invoice_date") or "",
            "invoiceCurrency": proj.commercial_invoice_currency,
            "invoiceValue": format_value(
                proj.commercial_invoice_value, currency=proj.commercial_invoice_currency
            )
            if proj.commercial_invoice_value
            else "-",
            "totalBillingValue": proj.get_formatted("total_billing_value"),
        },
        "notes": proj.project_notes or "",
        "attachments": [
            serialize_attachment(attachment)
            for attachment in get_attachments(proj.doctype, proj.name)
        ],
    }

    proj_res_object["transport"]["externalMeansOfTransportMode"] = MOT_MAP.get(
        proj.external_means_of_transport_code or "1"
    )

    return proj_res_object


def serialize_in_values(values):
    return ",".join(["'{}'".format(e) for e in values])


@frappe.whitelist()
def get_projects(
    user=None,
    customers=None,
    house_masters=None,
    statuses=None,
    start=0,
    page_length=10,
):

    user_authorized = False

    if frappe.session.user in PRIVILEGED_USERS:
        user_authorized = True

    if not user_authorized and user == frappe.session.user:
        user_authorized = True

    if not user_authorized:
        raise frappe.AuthenticationError

    if not statuses:
        statuses = DEFAULT_LIST_STATUSES
    else:
        statuses = json.loads(statuses)

    query = """
          SELECT 
            distinct(pu.parent) as name,
            proj.status,
            proj.total_items,
            commd.hs_code,
            commd.items,
            commd.hs_code_commercial_name_gr,
            commd.hs_code_commercial_name_en,
            proj.eta_or_etd,
            proj.external_means_of_transport,
            proj.external_means_of_transport_code,
            proj.days_of_free_demurrage_,
            proj.last_day_of_free_demurrage,
            file.file_count,
            'SHIP' as external_mot_mode
          FROM `tabProject User` pu 
            LEFT JOIN `tabProject` proj ON pu.parent = proj.name
            LEFT JOIN `tabCommodities data` commd ON commd.parent = pu.parent AND commd.idx = 1
            LEFT JOIN (
              SELECT 
                  count(*) as file_count, 
                  f.attached_to_name as f_proj_name
              FROM `tabFile` f WHERE f.attached_to_doctype = "Project" 
              GROUP BY f.attached_to_name
            ) file ON file.f_proj_name = pu.parent
          WHERE 
            pu.parenttype="Project" 
              AND pu.parentfield="users" 
              AND pu.user="{user}"
            AND proj.status IN ({statuses})            
        """.format(user=user, statuses=serialize_in_values(statuses))

    if customers:
        if isinstance(customers, basestring):
            customers = [customers]
        query += " AND proj.customer IN ({customers})".format(
            customers=serialize_in_values(customers)
        )

    if house_masters:
        if isinstance(house_masters, basestring):
            house_masters = [house_masters]
        query += " AND proj.house_master IN ({house_masters})".format(
            house_masters=serialize_in_values(house_masters)
        )

    query += " ORDER BY proj.name ASC, proj.date_of_customs_declaration ASC limit {start}, {page_length}".format(
        start=start, page_length=page_length
    )

    projects = frappe.db.sql(
        query,
        as_dict=True,
    )

    for e in projects:
        e.external_mot_mode = MOT_MAP.get(e.external_means_of_transport_code, "SHIP")

    agg_query = """
        SELECT 
        count(distinct(pu.parent)) as no_of_projects
        FROM `tabProject User` pu 
        LEFT JOIN `tabProject` proj ON pu.parent = proj.name
        WHERE 
        pu.parenttype="Project" 
            AND pu.parentfield="users" 
            AND pu.user="{user}"
        AND proj.status IN ({statuses})            
    """.format(user=user, statuses=serialize_in_values(statuses))

    if customers:
        agg_query += " AND proj.customer IN ({customers})".format(
            customers=serialize_in_values(customers)
        )

    if house_masters:
        agg_query += " AND proj.house_master IN ({house_masters})".format(
            house_masters=serialize_in_values(house_masters)
        )

    total_projects = frappe.db.sql(
        agg_query,
        as_dict=True,
    )

    return {"projects": projects, "total": total_projects[0].no_of_projects}


@frappe.whitelist()
def get_project_stats(user=None, customers=None, house_masters=None, statuses=None):

    user_authorized = False

    if frappe.session.user in PRIVILEGED_USERS:
        user_authorized = True

    if not user_authorized and user == frappe.session.user:
        user_authorized = True

    if not user_authorized:
        raise frappe.AuthenticationError

    if not statuses:
        statuses = DEFAULT_STATUSES

    query = """
          SELECT 
            proj.status,
            count(proj.status) as no_of_projects
          FROM `tabProject User` pu 
            LEFT JOIN `tabProject` proj ON pu.parent = proj.name
          WHERE 
            pu.parenttype="Project" 
              AND pu.parentfield="users" 
              AND pu.user="{user}"
            AND proj.status IN ({statuses})            
        """.format(user=user, statuses=serialize_in_values(statuses))

    if customers:
        if isinstance(customers, basestring):
            customers = [customers]
        query += " AND proj.customer IN ({customers})".format(
            customers=serialize_in_values(customers)
        )

    if house_masters:
        if isinstance(house_masters, basestring):
            house_masters = [house_masters]
        query += " AND proj.house_master IN ({house_masters})".format(
            house_masters=serialize_in_values(house_masters)
        )

    # Query may need to limit time-horizon but we don't know it yet

    query += " GROUP BY proj.status"
    print(query)
    projects = frappe.db.sql(
        query,
        as_dict=True,
    )

    return projects


@frappe.whitelist()
def mark_pre_payment(project):
    if frappe.db.get_value("Project", project, "status") in PRE_STATUS_LIST:
        frappe.db.set_value("Project", project, "pre_payment_inspection", 1)
        frappe.db.commit()
    else:
        frappe.throw(
            "Project is not in the correct state to select pre payment inspection.",
            frappe.ValidationError,
        )


@frappe.whitelist()
def cancel_mark_pre_payment(project):
    if frappe.db.get_value("Project", project, "status") in CANCEL_PRE_STATUS_LIST:
        frappe.db.set_value("Project", project, "pre_payment_inspection", 0)
        frappe.db.commit()
    else:
        frappe.throw(
            "Project is not in the correct state to cancel pre payment inspection.",
            frappe.ValidationError,
        )
