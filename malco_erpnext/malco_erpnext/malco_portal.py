# ruff: noqa: UP009, UP032, UP025
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from frappe import _
import json
from html2text import unescape, HTML2Text
from frappe.utils.formatters import format_value
from frappe.desk.form.load import get_attachments
from collections import OrderedDict
from frappe.core.doctype.user.user import (
    test_password_strength,
    _get_user_for_update_password,
    handle_password_test_fail,
    _update_password,
    reset_user_data,
)

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

CONTAINER_STATS_STATUSES = [
    "ETA or ETD",
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

MALCO_BO = "MALCO BO"


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
            "dateOfCompleteFolder": proj.get_formatted("date_of_complete_folder") or "",
            "dateOfEmptyContainerReturn": proj.get_formatted(
                "date_of_empty_container_return"
            )
            or "",
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
        "draftNotes": proj.draft_notes or "",
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
    page_length=20,
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
            proj.date_of_empty_container_return,
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


@frappe.whitelist()
def get_container_stats(user=None, customers=None, house_masters=None, statuses=None):

    user_authorized = False

    if frappe.session.user in PRIVILEGED_USERS:
        user_authorized = True

    if not user_authorized and user == frappe.session.user:
        user_authorized = True

    if not user_authorized:
        raise frappe.AuthenticationError

    if not statuses:
        statuses = CONTAINER_STATS_STATUSES

    query = """
            SELECT
                cd.commodity,
                cd.container_size,
                COUNT(*) AS containers,
                SUM(
                    CASE
                        WHEN cd.container_gross_weight REGEXP '^[0-9]+(\\.[0-9]+)?$'
                        THEN CAST(cd.container_gross_weight AS DECIMAL(18, 2))
                        ELSE 0
                    END
                ) AS gross_weight,
                proj.status
            FROM `tabContainer data` cd
                LEFT JOIN `tabProject User` pu ON pu.parent = cd.parent
                LEFT JOIN `tabProject` proj ON proj.name = pu.parent
            WHERE cd.commodity IS NOT NULL
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

    query += " GROUP BY cd.commodity, cd.container_size, proj.status"
    print(query)
    projects = frappe.db.sql(
        query,
        as_dict=True,
    )

    grouped = OrderedDict()

    for row in projects:
        status = row["status"]

        if status == "ETA or ETD":
            changed_status = "Under Way"

        elif status in (
            "Expecting Delivery Order or Data",
            "Under Pre payment Inspection",
            "Before ICISnet Progress",
            "Under ICISnet Progress",
            "Under Customs Control",
            "Under Balance Payment",
            "Under Delivery",
            "Under Destruction",
        ):
            changed_status = "Port"

        elif status in ("Completed", "Under Invoicing"):
            changed_status = "Completed"

        else:
            changed_status = status

        key = (changed_status, row["commodity"])

        if key not in grouped:
            grouped[key] = OrderedDict(
                [
                    ("status", changed_status),
                    ("commodity", row["commodity"]),
                    ("gross_weight", 0),
                    ("containers", 0),
                    ('20" Containers', 0),
                    ('40" Containers', 0),
                ]
            )

        item = grouped[key]

        gross_weight = row.get("gross_weight") or 0
        containers = row.get("containers") or 0

        item["gross_weight"] += gross_weight
        item["containers"] += containers

        if row["container_size"] == '20"':
            item['20" Containers'] += containers
        elif row["container_size"] == '40"':
            item['40" Containers'] += containers

    status_order = {
        "Under Way": 0,
        "Port": 1,
        "Completed": 2,
    }

    return sorted(
        grouped.values(), key=lambda item: status_order.get(item["status"], 99)
    )


@frappe.whitelist(allow_guest=True)
def reset_password(user):
    if user == "Administrator":
        return "not allowed"

    try:
        user = frappe.get_doc("User", user)
        if not user.enabled:
            return "disabled"
        user.validate_reset_password()
        link = user.reset_password(send_email=False)
        link = link.replace("https://erp.malco.gr", "https://portal.malco.gr")
        user.send_login_mail(
            _("Password Reset"),
            "password_reset",
            {"link": link, "login_url": "https://portal.malco.gr"},
            now=True,
        )
        return "OK"

    except frappe.DoesNotExistError:
        frappe.clear_messages()
        return "not found"


@frappe.whitelist(allow_guest=True)
def update_password(new_password, key=None, old_password=None):
    # raise ValueError(unescape(new_password), key, old_password)
    new_password = unescape(new_password)
    result = test_password_strength(new_password)
    feedback = result.get("feedback", None)

    if feedback and not feedback.get("password_policy_validation_passed", False):
        handle_password_test_fail(result)

    res = _get_user_for_update_password(key, old_password)
    if res.get("message"):
        return res["message"]
    else:
        user = res["user"]

    _update_password(user, new_password)
    reset_user_data(user)

    return "OK"


@frappe.whitelist()
def project_activity_scheduler():
    last_synced_version = frappe.db.sql(
        "select version, timestamp from `tabProject Activity` order by timestamp desc limit 1",
        as_dict=True,
    )
    if len(last_synced_version) == 0:
        return
    last_version = frappe.db.sql(
        "select name from `tabVersion` WHERE creation >= '{timestamp}' order by creation desc limit 1".format(
            timestamp=last_synced_version[0].timestamp
        ),
        as_dict=True,
    )
    if last_synced_version[0].version == last_version[0].name:
        return

    sync_project_activity(
        timestamp=last_synced_version[0].timestamp,
        last_version=last_synced_version[0].version,
    )


def sync_project_activity(interval=None, timestamp=None, last_version=None):
    versions = []
    if interval:
        versions = frappe.db.sql(
            """select name, docname, data, creation from `tabVersion` WHERE creation >= NOW() - INTERVAL {interval} DAY and ref_doctype='Project' order by creation desc""".format(
                interval=interval
            ),
            as_dict=True,
        )
    elif timestamp:
        versions = frappe.db.sql(
            """select name, docname, data, creation from `tabVersion` WHERE creation >= '{timestamp}' and ref_doctype='Project' order by creation desc""".format(
                timestamp=timestamp
            ),
            as_dict=True,
        )
    else:
        return

    last_version_check = bool(last_version)
    print("version check is ", last_version_check)

    for e in versions:
        if "status" in e.data:
            if (
                last_version_check
                and len(
                    frappe.get_list(
                        "Project Activity", filters=[["version", "=", e.name]]
                    )
                )
                > 0
            ):
                print(
                    "last version checked and record skipped {version}".format(
                        version=last_version
                    )
                )
                last_version_check = False
                continue
            json_data = json.loads(e.data)
            for ee in json_data.get("changed", []):
                if ee[0] == "status":
                    pa = frappe.new_doc("Project Activity")
                    if e.docname:
                        pa.project = e.docname
                        users = frappe.db.sql(
                            """
                            select user from `tabProject User` where parent="{project}"
                            """.format(project=e.docname),
                            as_dict=True,
                        )
                        if len(users) == 0:
                            break
                        pa.users = ",".join([x.user.lower() for x in users])
                        pa.activity_type = "Status Change"
                        pa.old_value = ee[1] or ""
                        pa.new_value = ee[2] or ""
                        pa.timestamp = e.creation
                        pa.version = e.name
                        pa.insert()
                    else:
                        break
    frappe.db.commit()


@frappe.whitelist()
def get_project_activities(user=None, statuses=None, start=0, page_length=10):
    if not user:
        raise frappe.ValidationError

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
            activity.project,
            activity.activity_type,
            activity.old_value,
            activity.new_value,
            activity.timestamp
          FROM `tabProject Activity` activity
          WHERE 
            activity.users LIKE "%{user}%" AND
            activity.timestamp >= NOW() - INTERVAL 7 DAY
          ORDER BY
            activity.timestamp DESC
        """.format(user=user.lower())

    query += " limit {start}, {page_length}".format(
        start=start, page_length=page_length
    )

    activities = frappe.db.sql(
        query,
        as_dict=True,
    )

    result = []

    for activity in activities:
        new_value = activity.new_value
        old_value = activity.old_value

        new_valid = new_value in statuses
        old_valid = old_value in statuses

        # Keep the valid status and mask the internal one
        if not new_valid:
            activity.old_value = MALCO_BO

        if not old_valid:
            activity.new_value = MALCO_BO

        result.append(activity)

    return result
