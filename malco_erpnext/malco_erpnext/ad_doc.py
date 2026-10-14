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


def run_ad_hoc(args=None):
    # projs = frappe.get_list(
    #     "Project",
    #     filters=[
    #         [
    #             "customer",
    #             "=",
    #             "ΕΛΒΑΛ ΧΑΛΚΟΡ ΕΛΛΗΝΙΚΗ ΒΙΟΜΗΧΑΝΙΑ ΧΑΛΚΟΥ ΚΑΙ ΑΛΟΥΜΙΝΟΥ ΑΝΩΝΥΜΟΣ ΕΤΑΙΡΕΙΑ",
    #         ]
    #     ],
    # )

    # for e in projs:
    #     project = frappe.get_doc("Project", e.name)
    #     user_found = False
    #     for user in project.users:
    #         if user.user == "stsamoutalis@halcor.com":
    #             user_found = True

    #     if not user_found:
    #         project.append(
    #             "users",
    #             {
    #                 "user": "stsamoutalis@halcor.com",
    #                 "user_contact": "Ioannis Mytilineos-ΕΛΒΑΛ ΧΑΛΚΟΡ ΕΛΛΗΝΙΚΗ ΒΙΟΜΗΧΑΝΙΑ ΧΑΛΚΟΥ ΚΑΙ ΑΛΟΥΜΙΝΟΥ ΑΝΩΝΥΜΟΣ ΕΤΑΙΡΕΙΑ",
    #             },
    #         )
    #         project.save()
    #         print("project ", project.name, " updated")
    # frappe.db.commit()
    return "OK"
