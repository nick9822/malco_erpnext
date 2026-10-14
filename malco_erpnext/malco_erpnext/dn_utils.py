# -*- coding: utf-8 -*-
# Copyright (c) 2017, GoElite and contributors
# For license information, please see license.txt

# ruff: noqa: UP032

from __future__ import unicode_literals
import frappe

"""
082247644;082247644;ΠΑΡΑΛΗΠΤΗΣ ΔΗΜΗΤΡΙΟΣ;ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ 3_0;ΜΕΝΕΜΕΝΗ, ΘΕΣΣΑΛΟΝΙΚ;-;0;EUR;2026-08-12;9.3;Α;515;0;0;0;0;
0.00;0.00;1;0;0;0;0;0;0;0;-;category3;0;0;0;0;-;ΠΙΝΑΚΕΣ ΕΝΔΕΙΞΕΩΝ, ΠΟΥ ΕΧΟΥΝ ΕΝΣΩΜΑΤΟΜΕΝΕΣ ΔΙΑΤΑΞΕΙΣ, ΜΕ ΦΩΤΟΔΙΟΔΟΥΣ LED ΑΛΛΟΙ.;44;1;-;1
-OURNAME EVRESIS AE
-CUSTNAME ΠΑΡΑΛΗΠΤΗΣ ΔΗΜΗΤΡΙΟΣ
-CUSTPROF 
-CUSTADDRESS ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ 3
-CUSTDOY 
-INVITIME 12:07:00
-ISPEPPOL 0
-loadingAddress GR002001FZ0083(VICTORY WAREHOUSE);0;ΘΕΣΣΑΛΟΝΙΚΗ;54626
-deliveryAddress ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ 3;0;ΜΕΝΕΜΕΝΗ, ΘΕΣΣΑΛΟΝΙΚ;-
-invoicetime 12:07:00
-dispatchdatetime 2026-08-12 12:07:00
-vehicleNumber ΕΚΒ1234/Ρ0000 
-movePurpose 19
-isdeliverynote 1
-OtherMovePurposeTitle ΔΕΛΤΙΟ ΔΙΑΚΙΝΗΣΗΣ ΕΚΤΕΛΩΝΙΣΘΕΝΤΩΝ ΕΜΠΟΡΕΥΜΑΤΩΝ
"""


@frappe.whitelist()
def create_file_to_sign(doc, method):
    # if doc.mydata_result == "OK":
    #     return

    # cgroup = frappe.db.get_value("Customer", doc.customer, "customer_group")
    # if cgroup == "Individual":
    #     return

    company_vat_id = frappe.db.get_value("Company", doc.company, "tax_id")
    customer_tax_id = frappe.db.get_value("Customer", doc.customer, "tax_id")
    customer_address = frappe.get_doc("Address", doc.customer_address)

    proj = frappe.get_doc("Project", doc.project_reference)
    physical_delivery_address = frappe.get_doc("Address", proj.physical_delivery)
    loading_customs_warehouse = frappe.get_doc(
        "Customs Warehouse", proj.customs_warehouse
    )

    # First Line
    # 082247644;082247644;ΠΑΡΑΛΗΠΤΗΣ ΔΗΜΗΤΡΙΟΣ;ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ 3_0;ΜΕΝΕΜΕΝΗ, ΘΕΣΣΑΛΟΝΙΚ;-;0;EUR;2026-08-12;9.3;Α;515;0;0;0;0;
    strwr = "{company_vat};{company_vat};".format(company_vat=company_vat_id)
    strwr += "{cust_name};{cust_add_billing1};{cust_add_city};{zip_code};".format(
        cust_name=doc.customer,
        cust_add_billing1=customer_address.address_line1,
        cust_add_city=customer_address.city or "-",
        zip_code=customer_address.pincode or "-",
    )

    strwr += "0;{inv_cur};{inv_date};{inv_value};Α;515;0;0;0;0;\n".format(
        inv_cur=doc.currency,
        inv_date=doc.posting_date,
        inv_value=doc.total,
    )

    # Second Line
    # 0.00;0.00;1;0;0;0;0;0;0;0;-;category3;0;0;0;0;-;ΠΙΝΑΚΕΣ ΕΝΔΕΙΞΕΩΝ, ΠΟΥ ΕΧΟΥΝ ΕΝΣΩΜΑΤΟΜΕΝΕΣ ΔΙΑΤΑΞΕΙΣ, ΜΕ ΦΩΤΟΔΙΟΔΟΥΣ LED ΑΛΛΟΙ.;44;1;-;1
    item_desciption = "-"
    item_qty = "-"
    if doc.commodities_data and len(doc.commodities_data) > 0:
        item_desciption = doc.commodities_data[0].commodity
        item_qty = doc.commodities_data[0].container_pieces
    strwr += "0.00;0.00;1;0;0;0;0;0;0;0;-;category3;0;0;0;0;-;{item_desciption};{item_qty};1;-;1\n".format(
        item_desciption=item_desciption, item_qty=item_qty
    )

    """
    -OURNAME EVRESIS AE
    -CUSTNAME ΠΑΡΑΛΗΠΤΗΣ ΔΗΜΗΤΡΙΟΣ
    -CUSTPROF 
    -CUSTADDRESS ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ 3
    -CUSTDOY 
    -INVITIME 12:07:00
    -ISPEPPOL 0
    -loadingAddress GR002001FZ0083(VICTORY WAREHOUSE);0;ΘΕΣΣΑΛΟΝΙΚΗ;54626
    -deliveryAddress ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ 3;0;ΜΕΝΕΜΕΝΗ, ΘΕΣΣΑΛΟΝΙΚ;-
    -invoicetime 12:07:00
    -dispatchdatetime 2026-08-12 12:07:00
    -vehicleNumber ΕΚΒ1234/Ρ0000 
    -movePurpose 19
    -isdeliverynote 1
    -OtherMovePurposeTitle ΔΕΛΤΙΟ ΔΙΑΚΙΝΗΣΗΣ ΕΚΤΕΛΩΝΙΣΘΕΝΤΩΝ ΕΜΠΟΡΕΥΜΑΤΩΝ
    """

    strwr += "-OURNAME {company}\n".format(company=doc.company)
    strwr += "-CUSTNAME {customer}\n".format(customer=doc.customer)
    strwr += "-CUSTPROF\n"
    strwr += "-CUSTADDRESS {cust_add_billing1}\n".format(
        cust_add_billing1=physical_delivery_address.address_line1
    )
    strwr += "-CUSTDOY\n"
    strwr += "-INVITIME {inv_time}\n".format(inv_time=doc.posting_time)
    strwr += "-ISPEPPOL 0\n"
    strwr += "-loadingAddress {warehouse_code}({warehouse_name});0;{warehouse_city};{warehouse_zipcode}\n".format(
        warehouse_code=loading_customs_warehouse.customs_warehouse_code,
        warehouse_name=loading_customs_warehouse.name,
        warehouse_city=loading_customs_warehouse.customs_warehouse_city or "-",
        warehouse_zipcode=loading_customs_warehouse.customs_warehouse_zip_code or "-",
    )
    strwr += (
        "-deliveryAddress {delivery_add1};0;{delivery_add_city};{zip_code}\n".format(
            delivery_add1=physical_delivery_address.address_line1,
            delivery_add_city=physical_delivery_address.city or "-",
            zip_code=physical_delivery_address.pincode or "-",
        )
    )
    strwr += "-dispatchdatetime {dispatch_date} {dispatch_time}\n".format(
        dispatch_date=doc.posting_date, dispatch_time=doc.posting_time
    )

    strwr += "-vehicleNumber ΟΔΙΚΩΣ\n"
    strwr += "-movePurpose 19\n"
    strwr += "-isdeliverynote 1\n"
    strwr += "-OtherMovePurposeTitle ΔΕΛΤΙΟ ΔΙΑΚΙΝΗΣΗΣ ΕΚΤΕΛΩΝΙΣΘΕΝΤΩΝ ΕΜΠΟΡΕΥΜΑΤΩΝ\n"

    # if doc.is_return:
    #     return_invoice = frappe.get_doc("Sales Invoice", doc.return_against)
    #     if (
    #         not return_invoice.mydata_official_mark_number
    #         or not return_invoice.mydata_evresis_id
    #     ):
    #         frappe.throw(
    #             "Original invoice doesn't have MyData attributes, contact Administrator."
    #         )
    #     strwr += (
    #         return_invoice.mydata_official_mark_number
    #         + ";"
    #         + return_invoice.mydata_evresis_id
    #         + ";"
    #     )

    with open("dns_for_komvos_sign/" + doc.name + ".txt", "w") as f:
        f.write(strwr.encode("utf-8"))

    # frappe.db.set_value("Delivery Note", doc.name, "mydata_infile_created", 1)
    # frappe.db.commit()
    frappe.msgprint("MyData file is created")
