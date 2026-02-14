# -*- coding: utf-8 -*-

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

CDT_MAP = {
        "EF15A": "EF15 - ΔΕΦΚ Καυσίμων - Fuel Excise duty declaration",
        "CC515A": "CC515A - Εξαγωγή - Export",
        "GR815A": "GR815A - eΔΕ - eDe"
}

HS_CODE_MAP = {
        "27102011391250": "2710201139000000001250",
        "27101245101222": "2710124510000000001222",
        "27101943": "2710194300000000000000"
}

MOT_MAP = {
        "ΟΔΙΚΩΣ:ΕΓΚ/ΣΕΙΣ JETOIL": "ΟΔΙΚΩΣ",
        "SR 8807 AB/SR 975 CA": "SR8807AB/SR975CA"
}

def get_trimmed_tag(tag):
        parts = tag.split("}")
        if len(parts) > 1:
                return parts[1]
        else:
                return tag

def read_xml_file(file_path):
        tree = ElementTree.parse(file_path)
        print(tree)
        root = tree.getroot()
        if "EF15A" in root.tag:
                print(CDT_MAP.get("EF15A"))
                create_ef15a(tree, file_path)
        elif "CC515A" in root.tag:
                print(CDT_MAP.get("CC515A"))
                create_cc515a(tree, file_path)
        elif "GR815A" in root.tag:
                print(CDT_MAP.get("GR815A"))
                create_gr815a(tree, file_path)
        else:
                print("unknown xml "+ root.tag)

def create_cc515a(tree, file_path):
        proj = frappe.new_doc("Project")
                
        project_notes = ""
        
        hsrows_counter = -1
        hsrows = []
        hs_code = ""

        ca_counter = -1
        carows = []

        curr_parent = ""

        for elem in tree.iter():                        
                proj.customs_document_type = CDT_MAP.get("CC515A")
                proj.status = "Imported by Kovmos"
                proj.payment_type = "Skip payment"
                proj.payment_reference = ""
                proj.combined_invoice = 1
                # proj.customs_declaration_character = "xml"
                proj.customs_agent_contractor = "ΒΑΚΑΛΗΣ ΤΑΤΣΙΚΑΣ ΚΑΙ ΣΙΑ ΟΕ"
                proj.customs_agent_eepa_meklame = "ΜΑΛΕΦΑΚΗΣ ΝΙΚΟΛΑΟΣ"

                if "MesIdeMES19" == get_trimmed_tag(elem.tag):
                        proj.mrn = elem.text
                        proj.project_name = elem.text

                if "TypOfDecHEA24" == get_trimmed_tag(elem.tag):
                        proj.project_type = elem.text

                if "DatOfPreMES9" == get_trimmed_tag(elem.tag):
                        dt = elem.text[-2:]
                        mnth = elem.text[-4:-2]
                        yr = elem.text[-6:-4]
                        proj.date_of_customs_declaration = "20"+yr+"-"+mnth+"-"+dt
                        proj.commercial_invoice_date = "20"+yr+"-"+mnth+"-"+dt

                if "CouOfDesCodHEA30" == get_trimmed_tag(elem.tag):
                        country = frappe.get_list('Country', filters={'code': elem.text}, fields=['name'])
                        if len(country) > 0:
                                proj.country_of_final_destination = country[0].name
                        else:
                                raise ValueError("No Country found with the given code "+ elem.text)
                
                if "AgrLocOfGooCodHEA38" == get_trimmed_tag(elem.tag):
                        wh = frappe.get_list('Customs Warehouse', filters={'customs_warehouse_code': elem.text}, fields=['name'])
                        if len(wh) > 0:
                                proj.customs_warehouse = wh[0].name
                        else:
                                print("No Customs warehouse found with the given code ", elem.text)
                                pass

                
                if "CouOfDisCodHEA55" == get_trimmed_tag(elem.tag):
                        country = frappe.get_list('Country', filters={'code': elem.text}, fields=['name'])
                        if len(country) > 0:
                                proj.country_of_import_or_export = country[0].name
                        else:
                                raise ValueError("No Country found with the given code "+ elem.text)

                if "InlTraModHEA75" == get_trimmed_tag(elem.tag):
                        proj.internal_means_of_transport_code = elem.text

                if "TraModAtBorHEA76" == get_trimmed_tag(elem.tag):
                        proj.external_means_of_transport_code = elem.text

                if "IdeOfMeaOfTraAtDHEA78" == get_trimmed_tag(elem.tag):
                        mot_wo_spaces = re.sub(r"\s+", "", elem.text)
                        mot_wo_spaces = frappe.db.exists("Means of Transport", mot_wo_spaces)
                        if not mot_wo_spaces and not elem.text in MOT_MAP:
                                print("No mapping of Mode of Transport from xml exists: ", elem.text, "file", file_path)
                        if mot_wo_spaces:
                                proj.internal_means_of_transport_21 = mot_wo_spaces
                        else:
                                proj.internal_means_of_transport_21 = MOT_MAP.get(elem.text, elem.text)

                if "IdeOfMeaOfTraCroHEA85" == get_trimmed_tag(elem.tag):
                        mot_wo_spaces = re.sub(r"\s+", "", elem.text)
                        mot_wo_spaces = frappe.db.exists("Means of Transport", mot_wo_spaces)
                        if not mot_wo_spaces and not elem.text in MOT_MAP:
                                print("No mapping of Mode of Transport from xml exists: ", elem.text, "file", file_path)
                        if mot_wo_spaces:
                                proj.external_means_of_transport = mot_wo_spaces
                        else:
                                proj.external_means_of_transport = MOT_MAP.get(elem.text, elem.text)
                
                if "DecPlaHEA394" == get_trimmed_tag(elem.tag):
                        proj.place_of_customs_declaration = elem.text
                
                if "TRAEXPEX1" == get_trimmed_tag(elem.tag):
                        curr_parent = "TRAEXPEX1"

                if "TINEX159" == get_trimmed_tag(elem.tag) and curr_parent == "TRAEXPEX1":
                        cust = frappe.get_list('Customer', filters={'eori_number': elem.text}, fields=['name'])
                        if len(cust) > 0:
                                proj.customer = elem.text = cust[0].name
                                proj.invoiced_to_payer = cust[0].name
                        else:
                                print("No Customer found with EORI Number "+ elem.text)

                if "TRACONCE1" == get_trimmed_tag(elem.tag):
                        curr_parent = "TRACONCE1"

                if "NamCE17" == get_trimmed_tag(elem.tag) and curr_parent == "TRACONCE1":
                        proj.house_master = elem.text
                
                if "RefNumERT1" == get_trimmed_tag(elem.tag):
                        proj.customs_authorities_of_declaration = elem.text
                        proj.customs_authorities_of_import_or_export = elem.text

                if "RefNumEXT1" == get_trimmed_tag(elem.tag):
                        proj.customs_authorities_of_transpassing = elem.text
                
                if "GOOITEGDS" ==  get_trimmed_tag(elem.tag):
                        curr_parent = "GOOITEGDS"
                        hsrows_counter += 1
                        hsrows.append({})
                
                if "GooDesGDS23" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["hs_code_description"] = elem.text
                
                if "GroMasGDS46" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["gross_weight"] = elem.text

                if "NetMasGDS48" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["net_weight"] = elem.text

                if "ProReqGDI1" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["field_37_a_1"] = elem.text

                if "PreProGDI1" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["field_37_a_2"] = elem.text

                if "ComNatProGIM1" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["field_37_b"] = elem.text
                
                if "StaValAmoGDI1" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["statistical_value"] = elem.text

                if "CouOfOriGDI1" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["country_of_origin_code"] = elem.text

                if "PreDocTypAR21" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["field_40_2"] = elem.text

                if "PreDocRefAR26" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["field_40_3"] = elem.text

                if "PreDocCatPREADMREF21" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["field_40_1"] = elem.text

                if "PRODOCDC2" == get_trimmed_tag(elem.tag):
                        curr_parent = "PRODOCDC2"
                        ca_counter += 1
                        carows.append({})
                        # carows[ca_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)

                if "DocTypDC21" == get_trimmed_tag(elem.tag):
                        ca = frappe.db.exists("Customs Documents", elem.text)
                        if ca:
                                carows[ca_counter]["document_code"] = elem.text
                        else:
                                carows[ca_counter]["document_code"] = elem.text
                                print("No mapping of Customs Documents from xml exists: ", elem.text, "file", file_path)

                if "DocRefDC23" == get_trimmed_tag(elem.tag):
                        carows[ca_counter]["document_number"] = elem.text
                
                if "COMCODGODITM" == get_trimmed_tag(elem.tag):
                        curr_parent = "COMCODGODITM"
                
                if "ComNomCMD1" == get_trimmed_tag(elem.tag):
                        hs_code += elem.text
                        hsrows[hsrows_counter]["hs_8"] = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)                        

                if "TARCodCMD1" == get_trimmed_tag(elem.tag):
                        hs_code += elem.text
                        hsrows[hsrows_counter]["hs_2"] = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)

                if "TARFirAddCodCMD1" == get_trimmed_tag(elem.tag):
                        hs_code += elem.text
                        hsrows[hsrows_counter]["hs_4"] = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)

                if "TARSecAddCodCMD1" == get_trimmed_tag(elem.tag):
                        hs_code += elem.text
                        hsrows[hsrows_counter]["hs_4_2"] = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)

                if "NAtAddCodCMD1" == get_trimmed_tag(elem.tag):
                        hs_code += elem.text
                        hsrows[hsrows_counter]["hs_4_3"] = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)
                        if not hs_code in HS_CODE_MAP and not frappe.db.exists("HS_Code", hs_code):
                                print("No mapping of HS_CODE from xml exists: ", hs_code, "file", file_path)

                if "KinOfPacGS23" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["packaging"] = elem.text

                if "TINTDE1" == get_trimmed_tag(elem.tag):
                        cam = frappe.get_list('Supplier', filters={'eori_number': elem.text}, fields=['name'])
                        if len(cam) > 0:
                                proj.customs_agent_master = cam[0].name
                        else:
                                print("No Supplier found with the given eori number "+ elem.text)
                                pass
                        
                if "IncCodTDL1" == get_trimmed_tag(elem.tag):
                        proj.incoterms = elem.text

                if "ComInfDELTER387" == get_trimmed_tag(elem.tag):
                        proj.incoterms_to = elem.text

                if "CurTRD1" == get_trimmed_tag(elem.tag):
                        proj.commercial_invoice_currency = elem.text

                if "TotAmoInvTRD1" == get_trimmed_tag(elem.tag):
                        proj.commercial_invoice_value = elem.text

                if "ExcRatTRD1" == get_trimmed_tag(elem.tag):
                        proj.commercial_invoice_currency_rate = elem.text
                        
        proj.project_notes = project_notes

        proj.set("commodities_data", [])
        proj.set("customs_attachments", [])

        for e in hsrows:
                print(e)
                proj.append("commodities_data", e)

        for e in carows:
                proj.append("customs_attachments", e)
        
        os.chdir("/home/frappe/frappe-bench/sites")
        print(proj, proj.__dict__)
        proj.insert()

def create_gr815a(tree, file_path):
        proj = frappe.new_doc("Project")
                
        project_notes = ""
        
        hsrows_counter = -1
        hsrows = []
        hs_code = ""

        ca_counter = -1
        carows = []

        guarantee_counter = -1
        guaranteerows = []

        curr_parent = ""
        
        for elem in tree.iter():                        
                proj.customs_document_type = CDT_MAP.get("GR815A")
                proj.status = "Imported by Kovmos"
                proj.payment_type = "Skip payment"
                proj.payment_reference = ""
                proj.combined_invoice = 1
                # proj.customs_declaration_character = "xml"
                proj.customs_agent_contractor = "ΒΑΚΑΛΗΣ ΤΑΤΣΙΚΑΣ ΚΑΙ ΣΙΑ ΟΕ"
                proj.customs_agent_eepa_meklame = "ΜΑΛΕΦΑΚΗΣ ΝΙΚΟΛΑΟΣ"

                if "MessageSender" == get_trimmed_tag(elem.tag):
                        cust = frappe.get_list('Customer', filters={'storage_permit': elem.text}, fields=['name'])
                        if len(cust) > 0:
                                proj.customer = cust[0].name
                                proj.invoiced_to_payer = cust[0].name
                        else:
                                raise ValueError("No Customer found with the given storage permit "+ elem.text)
                        
                if "MessageRecipient" == get_trimmed_tag(elem.tag):
                        proj.customs_authorities_of_declaration = elem.text
                        proj.customs_authorities_of_import_or_export = elem.text

                if "DateOfPreparation" == get_trimmed_tag(elem.tag):
                        proj.date_of_customs_declaration = elem.text
                        proj.commercial_invoice_date = elem.text

                if "MessageIdentifier" == get_trimmed_tag(elem.tag):
                        proj.mrn = elem.text
                        proj.project_name = elem.text

                # if "SubmissionMessageType" == get_trimmed_tag(elem.tag):
                #         proj.project_type_code = elem.text

                if "DeliveryPlaceTrader" == get_trimmed_tag(elem.tag):
                        curr_parent = "DeliveryPlaceTrader"

                if "Traderid" in elem.tag and curr_parent == "DeliveryPlaceTrader":
                        wh = frappe.get_list('Customs Warehouse', filters={'customs_warehouse_code': elem.text}, fields=['name'])
                        proj.customs_warehouse = wh[0].name

                if "CompetentAuthorityDispatchOffice" == get_trimmed_tag(elem.tag):
                        curr_parent = "CompetentAuthorityDispatchOffice"

                if "ReferenceNumber" in elem.tag and curr_parent == "CompetentAuthorityDispatchOffice":
                        proj.customs_authorities_of_declaration = elem.text
                        proj.customs_authorities_of_import_or_export = elem.text

                if "DocumentCertificate" == get_trimmed_tag(elem.tag):
                        ca_counter += 1
                        carows.append({})
                        # carows[ca_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)

                if "DocumentDescription" == get_trimmed_tag(elem.tag):
                        carows[ca_counter]["customs_document_description"] = elem.text

                if "ReferenceOfDocument" == get_trimmed_tag(elem.tag):
                        carows[ca_counter]["document_number"] = elem.text

                if "Guarantee" == get_trimmed_tag(elem.tag):
                        curr_parent = "Guarantee"
                        guarantee_counter += 1
                        guaranteerows.append({})

                if "GuaranteeAmount" == get_trimmed_tag(elem.tag):
                        guaranteerows[guarantee_counter]["amount"] = elem.text

                if "TaxIdNumber" in elem.tag and curr_parent == "Guarantee":
                        cust = frappe.get_list('Customer', filters={'eori_number': elem.text}, fields=['name'])
                        if len(cust) > 0:
                                guaranteerows[guarantee_counter]["customer"] = cust[0].name
                        else:
                                print("No Customer found for gurantee rows "+ elem.text)

                if "GuaranteeReferenceNumber" == get_trimmed_tag(elem.tag):
                        guaranteerows[guarantee_counter]["bank_guarantee_number_grn"] = elem.text


                if "BodyEad" == get_trimmed_tag(elem.tag):
                        curr_parent = "BodyEad"
                        hsrows_counter += 1
                        hsrows.append({})

                if "CnCode" == get_trimmed_tag(elem.tag):
                        hs_code = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)
                        if not hs_code in HS_CODE_MAP:
                                print("No mapping of HS_CODE from xml exists: ", hs_code, "file", file_path)
                
                if "Quantity" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["credit_weight"] = elem.text
                        hsrows[hsrows_counter]["gross_weight"] = elem.text
                        hsrows[hsrows_counter]["net_weight"] = elem.text

                if "GrossWeight" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["gross_weight"] = elem.text

                if "NetWeight" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["net_weight"] = elem.text

                if "Density" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["specific_weight_eb"] = elem.text

                if "CommercialDescription" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["hs_code_description"] =  elem.text

                if "BrandNameOfProducts" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["hs_code_commercial_name_gr"] =  elem.text

                if "TransportDetails" == get_trimmed_tag(elem.tag):
                        curr_parent = "TransportDetails"

                if "TransportUnitCode" == get_trimmed_tag(elem.tag):
                        proj.external_means_of_transport_code = elem.text

                if "IdentityOfTransportUnits" == get_trimmed_tag(elem.tag):
                        mot_wo_spaces = re.sub(r"\s+", "", elem.text)
                        mot_wo_spaces = frappe.db.exists("Means of Transport", mot_wo_spaces)
                        if not mot_wo_spaces and not elem.text in MOT_MAP:
                                print("No mapping of Mode of Transport from xml exists: ", elem.text, "file", file_path)
                        if mot_wo_spaces:
                                proj.external_means_of_transport = mot_wo_spaces
                        else:
                                proj.external_means_of_transport = MOT_MAP.get(elem.text, elem.text)

        proj.project_notes = project_notes

        proj.set("commodities_data", [])
        proj.set("customs_attachments", [])
        proj.set("bank_guarantee", [])

        print(proj, proj.__dict__)

        for e in hsrows:
                print(e)
                proj.append("commodities_data", e)

        for e in carows:
                proj.append("customs_attachments", e)

        # for e in guaranteerows:
        #         proj.append("bank_guarantee", e)             
        
        os.chdir("/home/frappe/frappe-bench/sites")
        proj.insert()


def create_ef15a(tree, file_path):
        proj = frappe.new_doc("Project")
                
        project_notes = ""
        
        hsrows_counter = -1
        hsrows = []
        hs_code = ""

        ca_counter = -1
        carows = []
        
        for elem in tree.iter():                        
                proj.customs_document_type = CDT_MAP.get("EF15A")
                proj.status = "Imported by Kovmos"
                proj.payment_type = "Skip payment"
                proj.payment_reference = ""
                proj.combined_invoice = 1
                # proj.customs_declaration_character = "xml"
                proj.customs_agent_contractor = "ΒΑΚΑΛΗΣ ΤΑΤΣΙΚΑΣ ΚΑΙ ΣΙΑ ΟΕ"
                proj.customs_agent_eepa_meklame = "ΜΑΛΕΦΑΚΗΣ ΝΙΚΟΛΑΟΣ"

                if "DateOfPreparation" == get_trimmed_tag(elem.tag):
                        proj.date_of_customs_declaration = elem.text
                        proj.commercial_invoice_date = elem.text

                if "MessageIdentifier" == get_trimmed_tag(elem.tag):
                        proj.mrn = elem.text
                        proj.project_name = elem.text

                if "SubmittingOperatorIdentification" == get_trimmed_tag(elem.tag):
                        cam = frappe.get_list('Supplier', filters={'tax_id': elem.text}, fields=['name'])
                        if len(cam) > 0:
                                proj.customs_agent_master = cam[0].name
                        else:
                                raise ValueError("No Supplier found with the given tax id "+ elem.text)
                        
                if "SubmittingTraderIdentification" == get_trimmed_tag(elem.tag):
                        cust = frappe.get_list('Customer', filters={'tax_id': elem.text}, fields=['name'])
                        if len(cust) > 0:
                                proj.customer = cust[0].name
                                proj.invoiced_to_payer = cust[0].name
                        else:
                                raise ValueError("No Customer found with the given tax id "+ elem.text)
                        
                if "RegistrationOffice" == get_trimmed_tag(elem.tag):
                        proj.customs_authorities_of_declaration = elem.text
                        proj.customs_authorities_of_import_or_export = elem.text

                if "DispatchCountry" == get_trimmed_tag(elem.tag):
                        country = frappe.get_list('Country', filters={'code': elem.text}, fields=['name'])
                        if len(country) > 0:
                                proj.country_of_import_or_export = country[0].name
                        else:
                                raise ValueError("No Country found with the given code "+ elem.text)
        
                if "DestinationCountry" == get_trimmed_tag(elem.tag):
                        country = frappe.get_list('Country', filters={'code': elem.text}, fields=['name'])
                        if len(country) > 0:
                                proj.country_of_final_destination = country[0].name
                        else:
                                raise ValueError("No Country found with the given code "+ elem.text)

                if "DeclarationTypeCode" == get_trimmed_tag(elem.tag):
                        proj.customs_document_code = elem.text

                if "TransportVehicleIdentificationNumber" == get_trimmed_tag(elem.tag):
                        mot_wo_spaces = re.sub(r"\s+", "", elem.text)
                        mot_wo_spaces = frappe.db.exists("Means of Transport", mot_wo_spaces)
                        if not mot_wo_spaces and not elem.text in MOT_MAP:
                                print("No mapping of Mode of Transport from xml exists: ", elem.text, "file", file_path)
                        if mot_wo_spaces:
                                proj.external_means_of_transport = mot_wo_spaces
                        else:
                                proj.external_means_of_transport = MOT_MAP.get(elem.text, elem.text)

                if "TransportVehicleCountry" == get_trimmed_tag(elem.tag):
                        proj.external_means_of_transport_country_code = elem.text

                if "NationalTransportMode" == get_trimmed_tag(elem.tag):
                        proj.external_means_of_transport_code = elem.text

                if "TaxOrVehicleWarehouseReference" == get_trimmed_tag(elem.tag):
                        wh = frappe.get_list('Customs Warehouse', filters={'customs_warehouse_code': elem.text}, fields=['name'])
                        proj.customs_warehouse = wh[0].name

                if "ExciseTaxesRow" == get_trimmed_tag(elem.tag):
                        hs_code = ""
                        hsrows_counter += 1
                        hsrows.append({})

                if "SymbolNumbers" == get_trimmed_tag(elem.tag):
                        project_notes = project_notes + elem.text + "\n"

                if "ProductDescription" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["hs_code_description"] =  elem.text
                
                if "TaricCode" == get_trimmed_tag(elem.tag):
                        hs_code = elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)
                
                if "TaricAdditionCode" == get_trimmed_tag(elem.tag):
                        hs_code += elem.text
                        hsrows[hsrows_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)
                        if not hs_code in HS_CODE_MAP:
                                print("No mapping of HS_CODE from xml exists: ", hs_code, "file", file_path)

                if "TaxQuantity" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["gross_weight"] = elem.text
                        hsrows[hsrows_counter]["net_weight"] = elem.text
                        hsrows[hsrows_counter]["credit_weight"] = elem.text

                if "NationalProductId" == get_trimmed_tag(elem.tag):
                        hsrows[hsrows_counter]["hs_code_opst"] = elem.text

                if "ReferenceDocuments" == get_trimmed_tag(elem.tag):
                        ca_counter += 1
                        carows.append({})
                        carows[ca_counter]["hs_code"] = HS_CODE_MAP.get(hs_code, hs_code)

                if "ReferenceDocumentId" == get_trimmed_tag(elem.tag):
                        carows[ca_counter]["customs_document_description"] = elem.text

                if "ReferenceDocumentNumber" == get_trimmed_tag(elem.tag):
                        carows[ca_counter]["document_number"] = elem.text

        # print(proj.__dict__)
        proj.project_notes = project_notes

        proj.set("commodities_data", [])
        proj.set("customs_attachments", [])

        print(proj, proj.__dict__)

        for e in hsrows:
                print(e)
                proj.append("commodities_data", e)

        for e in carows:
                proj.append("customs_attachments", e)
        
        os.chdir("/home/frappe/frappe-bench/sites")
        proj.insert()


@frappe.whitelist()
def parse_files():
        import_xml_path = "/home/frappe/frappe-bench/sites/projects_to_import/xmls"
        import_pdf_path = "/home/frappe/frappe-bench/sites/projects_to_import/pdfs"
        processed_path = "/home/frappe/frappe-bench/sites/projects_to_import/import_success"
        processed_error_path = "/home/frappe/frappe-bench/sites/projects_to_import/import_error"

        projects_to_commit = False

        for file in os.listdir(import_xml_path):
                os.chdir(import_xml_path)
                if file.endswith(".xml") and os.path.isfile(file):
                        file_path = import_xml_path + "/"+ file
                        print(file_path)

                        try:
                                read_xml_file(file_path)
                                print("finished processing successfully", file_path)
                        except Exception as e:
                                print("Processing", file_path, "Error:", e)
                        projects_to_commit = False
                        # proj_name = file.split("-")[0]
                        # try:
                        #         proj = frappe.get_doc("Project", proj_name)
                        #         output = read_xml_file(file_path)
                        #         print(output)
                        #         if output.get("error"):
                        #                 proj.rejection_reason = output.get["error"]
                        #                 shutil.move(file_path, processed_error_path+ "/"+ file)
                        #                 return
                        #         if output.get("lrn"):
                        #                 proj.mrn = output["mrn"]
                        #                 proj.icisnet_status = output["status"]
                        #                 proj.save()
                        #                 frappe.db.commit()
                        #                 shutil.move(file_path, processed_path+ "/"+ file)
                        #         else:
                        #                 print("skipped the file "+file_path)
                        #                 shutil.move(file_path, processed_error_path+ "/"+ file)        
                        # except Exception as e:
                        #         print(e)
                        #         shutil.move(file_path, processed_error_path+ "/"+ file)
        
        if projects_to_commit:
                # pass
                frappe.db.commit()