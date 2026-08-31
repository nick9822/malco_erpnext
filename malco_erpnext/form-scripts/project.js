pt.custom_customer = function (doc, cdt, cd) {
    ////cur_frm.set_value("physical_delivery", doc.customer);
    cur_frm.set_value("invoiced_to_payer", doc.customer);
};

cur_frm.cscript.custom_country_of_import_or_export = function (doc, cdt, cd) {
    cur_frm.set_value("country_of_origin", doc.country_of_import_or_export);
    if (doc.country_of_import_or_export == "Greece") {
        cur_frm.set_value("country_of_final_destination", "");
    }
    if (doc.country_of_import_or_export != "Greece") {
        cur_frm.set_value("country_of_final_destination", "Greece");
    }
};

cur_frm.add_fetch(
    "external_means_of_transport",
    "means_of_transport_code",
    "external_means_of_transport_code"
);
cur_frm.add_fetch(
    "internal_means_of_transport_21",
    "means_of_transport_code",
    "internal_means_of_transport_code"
);

frappe.ui.form.on(
    "Project",
    "internal_means_of_transport_21",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Means of Transport",
                fieldname: "means_of_transport_nationality",
                filters: {
                    name: ["=", p.internal_means_of_transport_21],
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data.message.means_of_transport_nationality);
                //frappe.db.set_value(p.doctype, p.name, "internal_means_of_transport_country_code", data.message.means_of_transport_code);
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Country",
                        fieldname: "code",
                        filters: {
                            name: ["=", data.message.means_of_transport_nationality],
                        },
                    },
                    freeze: true,
                    callback: function (res) {
                        console.log(res.message.code);
                        frappe.model.set_value(
                            p.doctype,
                            p.name,
                            "internal_means_of_transport_country_code",
                            res.message.code.toUpperCase()
                        );
                        refresh_field("internal_means_of_transport_country_code");
                    },
                });
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "customs_authorities_of_declaration",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        p.missing_xml_data = [];

        cur_frm.set_value(
            "customs_authorities_of_import_or_export",
            p.customs_authorities_of_declaration
        );
        cur_frm.set_value(
            "customs_authorities_of_transpassing",
            p.customs_authorities_of_declaration
        );
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customs Authorities",
                fieldname: "customs_authorities_old_code",
                filters: {
                    name: ["=", p.customs_authorities_of_declaration],
                },
            },
            freeze: true,
            callback: function (data) {
                var crow = cur_frm.add_child("missing_xml_data");
                crow.customs_authority_old_code =
                    data.message.customs_authorities_old_code;
                refresh_field("missing_xml_data");
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "commercial_invoice_currency",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Customs currency rates",

                filters: {
                    currency: ["=", p.commercial_invoice_currency],
                    currency_start_date: ["<=", p.date_of_customs_declaration],
                },
                order_by: "name",
                limit_page_length: 500,
            },
            freeze: true,
            callback: function (data) {
                var getname = data.message[data.message.length - 1].name;
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Customs currency rates",
                        fieldname: "customs_currency_rate",
                        filters: {
                            name: ["=", getname],
                        },
                    },
                    freeze: true,
                    callback: function (data) {
                        frappe.model.set_value(
                            p.doctype,
                            p.name,
                            "commercial_invoice_currency_rate",
                            data.message.customs_currency_rate
                        );
                        if (
                            p.commercial_invoice_currency_rate !=
                            data.message.customs_currency_rate
                        ) {
                            frappe.model.set_value(
                                p.doctype,
                                p.name,
                                "commercial_invoice_currency_rate",
                                data.message.customs_currency_rate
                            );

                            for (var e = 0; e < p.commodities_data.length; e++) {
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.commercial_price_currency = p.commercial_invoice_currency;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.freight_currency = p.commercial_invoice_currency;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.insurance_currency = p.commercial_invoice_currency;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.commercial_price_currency_rate =
                                    p.commercial_invoice_currency_rate;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.freight_currency_rate =
                                    p.commercial_invoice_currency_rate;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.insurance_currency_rate =
                                    p.commercial_invoice_currency_rate;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.commercial_price = p.commercial_invoice_value;
                                refresh_field("commodities_data");

                                var obitotal =
                                    flt(p.commodities_data[e].commercial_price) /
                                    flt(p.commodities_data[e].commercial_price_currency_rate);
                                var ofitotal =
                                    flt(p.commodities_data[e].freight) /
                                    flt(p.commodities_data[e].freight_currency_rate);
                                var oiitotal =
                                    flt(p.commodities_data[e].insurance) /
                                    flt(p.commodities_data[e].insurance_currency_rate);

                                var oteuro_total =
                                    flt(obitotal) + flt(ofitotal) + flt(oiitotal);

                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.total_value = oteuro_total;
                                cur_frm.get_field("commodities_data").grid.grid_rows[
                                    e
                                ].doc.statistical_value = flt(oteuro_total).toFixed(2);
                                refresh_field("commodities_data");
                            }
                        }
                    },
                });
            },
        });
    }
);

frappe.ui.form.on("Project", "delivery_order", function (frm, cdt, cdn) { });

frappe.ui.form.on("Project", "customs_warehouse", function (frm, cdt, cdn) {
    var p = frm.doc;
});

frappe.ui.form.on("Commodities data", "hs_code", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    console.log("new");
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "HS_Code",
            fieldname: "hs_code_description",
            filters: {
                name: d.hs_code,
            },
        },
        freeze: true,
        callback: function (data) {
            frappe.model.set_value(
                d.doctype,
                d.name,
                "hs_code_description",
                data.message.hs_code_description
            );
        },
    });

    frappe.model.set_value(
        d.doctype,
        d.name,
        "price_of_product",
        p.commercial_invoice_value
    );
    if (p.commercial_invoice_currency == "EUR") {
        frappe.model.set_value(d.doctype, d.name, "kem", "5");
    }
    if (p.commercial_invoice_currency != "EUR") {
        frappe.model.set_value(d.doctype, d.name, "kem", "1");
    }

    //frappe.model.set_value(d.doctype, d.name, "statistical_value", p.commercial_invoice_value);
    frappe.model.set_value(
        d.doctype,
        d.name,
        "commercial_price_currency",
        p.commercial_invoice_currency
    );
    frappe.model.set_value(
        d.doctype,
        d.name,
        "freight_currency",
        p.commercial_invoice_currency
    );
    frappe.model.set_value(
        d.doctype,
        d.name,
        "insurance_currency",
        p.commercial_invoice_currency
    );
    frappe.model.set_value(
        d.doctype,
        d.name,
        "commercial_price_currency_rate",
        p.commercial_invoice_currency_rate
    );
    frappe.model.set_value(
        d.doctype,
        d.name,
        "freight_currency_rate",
        p.commercial_invoice_currency_rate
    );
    frappe.model.set_value(
        d.doctype,
        d.name,
        "insurance_currency_rate",
        p.commercial_invoice_currency_rate
    );
    frappe.model.set_value(
        d.doctype,
        d.name,
        "commercial_price",
        p.commercial_invoice_value
    );
    frappe.model.set_value(d.doctype, d.name, "record", p.record);
    frappe.model.set_value(
        d.doctype,
        d.name,
        "country_of_origin_commodity",
        p.country_of_origin
    );
    refresh_field("country_of_origin_commodity", d.name, "commodities_data");
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Country",
            fieldname: "code",
            filters: {
                name: ["=", d.country_of_origin_commodity],
            },
        },
        freeze: true,
        callback: function (res) {
            frappe.model.set_value(
                d.doctype,
                d.name,
                "country_of_origin_code",
                res.message.code.toUpperCase()
            );
        },
    });
});

frappe.ui.form.on(
    "Commodities data",
    "country_of_origin_commodity",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Country",
                fieldname: "code",
                filters: {
                    name: ["=", d.country_of_origin_commodity],
                },
            },
            freeze: true,
            callback: function (res) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "country_of_origin_code",
                    res.message.code.toUpperCase()
                );
            },
        });
        refresh_field("country_of_origin_code", d.name, "commodities_data");
    }
);

frappe.ui.form.on(
    "Commodities data",
    "commercial_price",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        var obitotal =
            flt(d.commercial_price) / flt(d.commercial_price_currency_rate);
        var ofitotal = flt(d.freight) / flt(d.freight_currency_rate);
        var oiitotal = flt(d.insurance) / flt(d.insurance_currency_rate);

        var oteuro_total = flt(obitotal) + flt(ofitotal) + flt(oiitotal);
        var sval = flt(oteuro_total).toFixed(2);
        frappe.model.set_value(d.doctype, d.name, "total_value", oteuro_total);
        frappe.model.set_value(d.doctype, d.name, "statistical_value", sval);
    }
);

frappe.ui.form.on("Commodities data", "freight", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    var obitotal =
        flt(d.commercial_price) / flt(d.commercial_price_currency_rate);
    var ofitotal = flt(d.freight) / flt(d.freight_currency_rate);
    var oiitotal = flt(d.insurance) / flt(d.insurance_currency_rate);

    var oteuro_total = flt(obitotal) + flt(ofitotal) + flt(oiitotal);
    var sval = flt(oteuro_total).toFixed(2);
    frappe.model.set_value(d.doctype, d.name, "total_value", oteuro_total);
    frappe.model.set_value(d.doctype, d.name, "statistical_value", sval);
});

frappe.ui.form.on("Commodities data", "insurance", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    var obitotal =
        flt(d.commercial_price) / flt(d.commercial_price_currency_rate);
    var ofitotal = flt(d.freight) / flt(d.freight_currency_rate);
    var oiitotal = flt(d.insurance) / flt(d.insurance_currency_rate);

    var oteuro_total = flt(obitotal) + flt(ofitotal) + flt(oiitotal);
    var sval = flt(oteuro_total).toFixed(2);
    frappe.model.set_value(d.doctype, d.name, "total_value", oteuro_total);
    frappe.model.set_value(d.doctype, d.name, "statistical_value", sval);
});

frappe.ui.form.on("Commodities data", "total_value", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    //frappe.model.set_value(d.doctype, d.name, "statistical_value", float(d.total_value).toFixed(2));
});

frappe.ui.form.on("Project", "fetch_values", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var titems = 0;
    var tgweight = 0;
    var tnweight = 0;
    var tcom = 0;
    var tfr = 0;
    var tir = 0;
    var tlitres = 0;
    var tcfi = 0;

    for (var i = 0; i < frm.doc.commodities_data.length; i++) {
        tcom = tcom + flt(frm.doc.commodities_data[i].commercial_price);
        tfr = tfr + flt(frm.doc.commodities_data[i].freight);
        tir = tir + flt(frm.doc.commodities_data[i].insurance);
        titems = titems + flt(frm.doc.commodities_data[i].items);
        tgweight = tgweight + flt(frm.doc.commodities_data[i].gross_weight);
        tnweight = tnweight + flt(frm.doc.commodities_data[i].net_weight);
        tlitres = tlitres + flt(frm.doc.commodities_data[i].litres);
        tcfi =
            tcfi +
            flt(frm.doc.commodities_data[i].commercial_price) +
            frm.doc.commodities_data[i].freight +
            flt(frm.doc.commodities_data[i].insurance);
    }
    frappe.model.set_value(p.doctype, p.name, "total_commercial_value", tcom);
    frappe.model.set_value(p.doctype, p.name, "total_freight_value", tfr);
    frappe.model.set_value(p.doctype, p.name, "total_insurance_value", tir);
    frappe.model.set_value(p.doctype, p.name, "total_items", titems);
    frappe.model.set_value(p.doctype, p.name, "total_gross_weight", tgweight);
    frappe.model.set_value(p.doctype, p.name, "total_net_weight", tnweight);
    frappe.model.set_value(p.doctype, p.name, "total_litres", tlitres);
    frappe.model.set_value(p.doctype, p.name, "total_cfi", tcfi);

    var a1 = 0;
    var a2 = 0;
    var a3 = 0;
    var a4 = 0;
    var a5 = 0;
    var totalalcohol = 0;

    a1 = flt(frm.doc.total_litres) * flt(frm.doc.alcohol_1st_multiple);
    a2 = (flt(a1) * flt(frm.doc.alcohol_2nd_multiple)) / 100;
    a3 = (flt(a1) * flt(frm.doc.alcohol_3rd_multiple)) / 100;
    a4 = (flt(a3) * flt(frm.doc.alcohol_4th_multiple)) / 100;
    a5 = (flt(a4) * flt(frm.doc.alcohol_5th_multiple)) / 100;
    totalalcohol = a1 + a2 + a3 + a4 + a5;
    frappe.model.set_value(p.doctype, p.name, "alcohol_1st_outcome", a1);
    frappe.model.set_value(p.doctype, p.name, "alcohol_2nd_outcome", a2);
    frappe.model.set_value(p.doctype, p.name, "alcohol_3rd_outcome", a3);
    frappe.model.set_value(p.doctype, p.name, "alcohol_4th_outcome", a4);
    frappe.model.set_value(p.doctype, p.name, "alcohol_5th_outcome", a5);

    frappe.model.set_value(
        p.doctype,
        p.name,
        "total_alcohol_outcome",
        totalalcohol
    );
    if (frm.doc.project_type != "T2L") {
        var nrow = frm.add_child("customs_attachments");
        nrow.document_code = "1902";
        nrow.customs_document_description = "ΕΞΟΥΣΙΟΔΟΤΗΣΗ ΑΝΤΙΠΡΟΣΩΠΟΥ";
        nrow.document_number = "x";
        nrow.is_automatic = 1;
        refresh_field("customs_attachments");

        if (p.delivery_order != 0) {
            var orow = frm.add_child("customs_attachments");
            orow.document_code = "1906";
            orow.customs_document_description = "ΔΙΑΤΑΚΤΙΚΗ";
            orow.document_number = p.delivery_order;
            orow.is_automatic = 1;
            refresh_field("customs_attachments");
        }

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customs Warehouse",
                fieldname: "customs_warehouse_18_character",
                filters: {
                    name: ["=", p.customs_warehouse],
                },
            },
            freeze: true,
            callback: function (data) {
                if (jQuery.isEmptyObject(data)) {
                    console.log("Blank Response");
                } else {
                    if (
                        data.message.customs_warehouse_18_character != "" &&
                        data.message.customs_warehouse_18_character != "0"
                    ) {
                        var nrow = frm.add_child("customs_attachments");
                        nrow.document_code = "C600";
                        nrow.customs_document_description =
                            "ΑΔΕΙΑ ΓΙΑ ΤΗΝ ΔΙΑΧΕΙΡΙΣΗ ΤΕΛ. ΑΠΟΤΑΜΙΕΥΣΗΣ";
                        nrow.document_number = data.message.customs_warehouse_18_character;
                        nrow.is_automatic = 1;
                    }
                    refresh_field("customs_attachments");
                }
            },
        });
    }

    for (var i = 0; i < frm.doc.commodities_data.length; i++) {
        cp = frm.doc.commodities_data[i].commercial_price;
        fp = frm.doc.commodities_data[i].freight;
        ip = frm.doc.commodities_data[i].insurance;

        cc = frm.doc.commodities_data[i].commercial_price_currency;
        fc = frm.doc.commodities_data[i].freight_currency;
        ic = frm.doc.commodities_data[i].insurance_currency;

        ccr = frm.doc.commodities_data[i].commercial_price_currency_rate;
        fcr = frm.doc.commodities_data[i].freight_currency_rate;
        icr = frm.doc.commodities_data[i].insurance_currency_rate;

        var obitotal = flt(cp) / flt(ccr);
        var ofitotal = flt(fp) / flt(fcr);
        var oiitotal = flt(ip) / flt(icr);

        var crow = frm.add_child("financial_analysis");
        crow.hs_code = frm.doc.commodities_data[i].hs_code;
        crow.financial_data = "Commercial Price";
        crow.financial_data_value = cp;
        crow.financial_currency = cc;
        crow.currency_rate = ccr;
        crow.euro_total = obitotal;
        crow.is_automatic = 1;
        refresh_field("financial_analysis");

        if (flt(fp) > 0) {
            var frow = frm.add_child("financial_analysis");
            frow.hs_code = frm.doc.commodities_data[i].hs_code;
            frow.financial_data = "Freight";
            frow.financial_data_value = fp;
            frow.financial_currency = fc;
            frow.currency_rate = fcr;
            frow.euro_total = ofitotal;
            frow.is_automatic = 1;
            refresh_field("financial_analysis");
        }
        if (flt(ip) > 0) {
            var irow = frm.add_child("financial_analysis");
            irow.hs_code = frm.doc.commodities_data[i].hs_code;
            irow.financial_data = "Insurance";
            irow.financial_data_value = ip;
            irow.financial_currency = ic;
            irow.currency_rate = icr;
            irow.euro_total = oiitotal;
            irow.is_automatic = 1;
            refresh_field("financial_analysis");
        }

        var trow = frm.add_child("financial_analysis");
        trow.hs_code = frm.doc.commodities_data[i].hs_code;
        trow.financial_data = "Total value";
        trow.financial_currency = "EUR";
        trow.currency_rate = "1";
        trow.euro_total = flt(obitotal) + flt(ofitotal) + flt(oiitotal);
        trow.is_automatic = 1;
        refresh_field("financial_analysis");
    }

    var totalfctotal = 0;
    var totalfcvattotal = 0;
    var freightfctotal = 0;
    var insurancefctotal = 0;

    for (var i = 0; i < frm.doc.customs_attachments.length; i++) {
        if (frm.doc.customs_attachments[i].document_code == "1902") {
            frm.doc.customs_attachments[i].hs_code =
                frm.doc.commodities_data[0].hs_code;
        }
        if (frm.doc.customs_attachments[i].document_code == "1906") {
            frm.doc.customs_attachments[i].hs_code =
                frm.doc.commodities_data[0].hs_code;
        }
        if (frm.doc.customs_attachments[i].document_code == "C600") {
            frm.doc.customs_attachments[i].hs_code =
                frm.doc.commodities_data[0].hs_code;
        }
    }
    if (frm.doc.commodities_data[0].preferential_status > 0) {
        if (frm.doc.project_type != "T2L") {
            var nrow = frm.add_child("customs_attachments");
            nrow.hs_code = frm.doc.commodities_data[0].hs_code;
            nrow.document_code = "N935";
            nrow.customs_document_description = "ΤΙΜΟΛΟΓΙΟ ΕΙΣΑΓΩΓΗΣ";
            nrow.document_number = p.commercial_invoice_number;
            nrow.is_automatic = 1;

            var nrow = frm.add_child("customs_attachments");
            nrow.hs_code = frm.doc.commodities_data[0].hs_code;
            nrow.document_code = "N271";
            nrow.customs_document_description = "ΚΑΤΑΛΟΓΟΣ ΣΥΣΚΕΥΑΣΙΑΣ";
            nrow.document_number = p.commercial_invoice_number;
            nrow.is_automatic = 1;

            var nrow = frm.add_child("customs_attachments");
            nrow.hs_code = frm.doc.commodities_data[0].hs_code;
            nrow.document_code = "N934";
            nrow.customs_document_description =
                "ΔΗΛΩΣΗ ΤΩΝ ΣΧΕΤΙΚΩΝ ΜΕ ΤΗΝ ΔΑΣΜΟΛΟΓΗΤΕΑ ΑΞΙΑ ΣΤΟΙΧΕΙΩΝ ΕΝΤΥΠΟ";
            nrow.document_number = "x";
            nrow.is_automatic = 1;

            if (p.external_means_of_transport_code == 1) {
                var nrow = frm.add_child("customs_attachments");
                nrow.hs_code = frm.doc.commodities_data[0].hs_code;
                nrow.document_code = "1903";
                nrow.customs_document_description = "ΦΟΡΤΩΤΙΚΗ ΘΑΛΑΣΣΙΑΣ ΜΕΤΑΦΟΡΑΣ";
                nrow.document_number = p.master_bol_or_cmr;
                nrow.is_automatic = 1;
            }
            if (p.external_means_of_transport_code == 3) {
                var nrow = frm.add_child("customs_attachments");
                nrow.hs_code = frm.doc.commodities_data[0].hs_code;
                nrow.document_code = "N703";
                nrow.customs_document_description = "Δελτίο αποστολής";
                nrow.document_number = "x";
                nrow.is_automatic = 1;
            }
            /* Change requested on 23/05/2017
                          if(p.external_means_of_transport_code ==3){		
                              var nrow = frm.add_child("customs_attachments");
                              nrow.hs_code = frm.doc.commodities_data[0].hs_code;
                              nrow.document_code = "N741";
                              nrow.customs_document_description = "Κύρια αεροπορική φορτωτική μεταφοράς";
                              nrow.document_number = p.master_bol_or_cmr;
                              nrow.is_automatic =1;
                          }
                          */
            refresh_field("customs_attachments");
        }
    } else {
        if (frm.doc.project_type == "T2L") {
            var nrow = frm.add_child("customs_attachments");
            nrow.hs_code = frm.doc.commodities_data[0].hs_code;
            nrow.document_code = "380";
            nrow.customs_document_description = "ΤΙΜΟΛΟΓΙΟ ΕΞΑΓΩΓΗΣ";
            nrow.document_number = p.commercial_invoice_number;
            nrow.is_automatic = 1;
            refresh_field("customs_attachments");
        } else {
            var nrow = frm.add_child("customs_attachments");
            nrow.hs_code = frm.doc.commodities_data[0].hs_code;
            nrow.document_code = "N380";
            nrow.customs_document_description = "ΤΙΜΟΛΟΓΙΟ ΕΞΑΓΩΓΗΣ";
            nrow.document_number = p.commercial_invoice_number;
            nrow.is_automatic = 1;

            var nrow = frm.add_child("customs_attachments");
            nrow.hs_code = frm.doc.commodities_data[0].hs_code;
            nrow.document_code = "N271";
            nrow.customs_document_description = "ΚΑΤΑΛΟΓΟΣ ΣΥΣΚΕΥΑΣΙΑΣ";
            nrow.document_number = p.commercial_invoice_number;
            nrow.is_automatic = 1;

            if (p.external_means_of_transport_code == 3) {
                var nrow = frm.add_child("customs_attachments");
                nrow.hs_code = frm.doc.commodities_data[0].hs_code;
                nrow.document_code = "N703";
                nrow.customs_document_description = "Δελτίο αποστολής";
                nrow.document_number = "x";
                nrow.is_automatic = 1;
            }
            /* Change requested on 23/05/2017
                          if(p.external_means_of_transport_code ==4){		
                              var nrow = frm.add_child("customs_attachments");
                              nrow.hs_code = frm.doc.commodities_data[0].hs_code;
                              nrow.document_code = "N741";
                              nrow.customs_document_description = "Κύρια αεροπορική φορτωτική μεταφοράς";
                              nrow.document_number = p.master_bol_or_cmr;
                              nrow.is_automatic =1;
                          }
                          */
            refresh_field("customs_attachments");
        }
    }
    /*	
                  if( frm.doc.delivery_order != "0"){
                      var rrow = frm.add_child("customs_duties_analysis");
                      rrow.hs_code = frm.doc.commodities_data[0].hs_code;
                      rrow.customs_charges_code = "800";
                      rrow.customs_charges_description = "Delivery order";
                      rrow.way_of_payment_duties = "V";
                      rrow.tax_base = "";
                      rrow.coefficient = " ";
                      rrow.customs_charge = flt(frm.doc.delivery_order_net_price);
                      rrow.is_automatic =1;			
                      refresh_field("customs_duties_analysis")				
                  	
                  };	
              */

    if (p.external_means_of_transport_code == 4) {
        var nrow = frm.add_child("customs_attachments");
        nrow.hs_code = frm.doc.commodities_data[0].hs_code;
        nrow.document_code = "N741";
        nrow.customs_document_description = "Κύρια αεροπορική φορτωτική μεταφοράς";
        nrow.document_number = p.master_bol_or_cmr;
        nrow.is_automatic = 1;
    }

    for (var i = 0; i < frm.doc.commodities_data.length; i++) {
        var code = frm.doc.commodities_data[i].hs_code;
        var ptv = frm.doc.commodities_data[i].total_value;
        var dov = frm.doc.delivery_order_net_price;
        if (i == 0) {
            var tv = flt(ptv) + flt(dov);
        }
        if (i > 0) {
            var tv = flt(ptv);
        }
        var w = frm.doc.commodities_data[i].net_weight;
        var weight = flt(w) / 100;

        var royal = frm.doc.commodities_data[i].royalties;
        var cduty = frm.doc.commodities_data[i].customs_duties;
        var vat = frm.doc.commodities_data[i].vat;
        var agri = frm.doc.commodities_data[i].agricultural_duties;
        var antidump = frm.doc.commodities_data[i].antidumping_duties;
        var efk = frm.doc.commodities_data[i].efk;

        var troyal = 0;
        var tagri = 0;

        var dvat = 0;
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item Tax",
                fieldname: "tax_rate",
                filters: {
                    parent: ["=", "Διατακτική - Delivery order"],
                },
            },
            async: false,
            freeze: true,
            callback: function (data) {
                dvat = data.message.tax_rate;
            },
        });

        if (cduty != 0) {
            var rrow = frm.add_child("customs_duties_analysis");

            rrow.hs_code = code;
            rrow.customs_charges_code = "A00";
            rrow.customs_charges_description = "Import duties";
            rrow.way_of_payment_duties = "H";
            rrow.tax_base = flt(ptv).toFixed(2);
            rrow.coefficient = cduty.toFixed(2);
            rrow.customs_charge = ((flt(cduty) * flt(ptv)) / 100).toFixed(2);
            rrow.is_automatic = 1;
            refresh_field("customs_duties_analysis");
        }

        if (royal != 0) {
            var rrow = frm.add_child("customs_duties_analysis");
            rrow.hs_code = code;
            rrow.customs_charges_code = "A00";
            rrow.customs_charges_description = "Import duties";
            rrow.way_of_payment_duties = "H";
            rrow.tax_base = flt(weight).toFixed(2);
            rrow.coefficient = royal.toFixed(2);
            if (weight > 1) {
                rrow.customs_charge = (flt(royal) * flt(weight)).toFixed(2);
                troyal = (flt(royal) * flt(weight)).toFixed(2);
            }
            if (weight <= 1) {
                rrow.customs_charge = (flt(royal) * 1).toFixed(2);
                troyal = (flt(royal) * 1).toFixed(2);
            }
            rrow.is_automatic = 1;
            refresh_field("customs_duties_analysis");
        }

        if (agri != 0) {
            var rrow = frm.add_child("customs_duties_analysis");
            rrow.hs_code = code;
            rrow.customs_charges_code = "A00";
            rrow.customs_charges_description = "Import duties";
            rrow.way_of_payment_duties = "H";
            rrow.tax_base = flt(weight).toFixed(2);
            rrow.coefficient = agri.toFixed(2);
            if (w > 100) {
                rrow.customs_charge = ((flt(agri) * flt(w)) / 100).toFixed(2);
                tagri = ((flt(agri) * flt(w)) / 100).toFixed(2);
            }
            if (w <= 100) {
                rrow.customs_charge = (flt(agri) * 1).toFixed(2);
                tagri = (flt(agri) * 1).toFixed(2);
            }
            rrow.is_automatic = 1;
            refresh_field("customs_duties_analysis");
        }

        if (antidump != 0) {
            var rrow = frm.add_child("customs_duties_analysis");
            rrow.hs_code = code;
            rrow.customs_charges_code = "A00";
            rrow.customs_charges_description = "Import duties";
            rrow.way_of_payment_duties = "H";
            rrow.tax_base = flt(ptv).toFixed(2);
            rrow.coefficient = antidump.toFixed(2);
            rrow.customs_charge = ((flt(antidump) * flt(ptv)) / 100).toFixed(2);
            rrow.is_automatic = 1;
            refresh_field("customs_duties_analysis");
        }

        if (efk != 0) {
            var rrow = frm.add_child("customs_duties_analysis");
            rrow.hs_code = code;
            rrow.customs_charges_code = "A00";
            rrow.customs_charges_description = "Import duties";
            rrow.way_of_payment_duties = "H";
            rrow.tax_base = flt(ptv).toFixed(2);
            rrow.coefficient = efk.toFixed(2);
            rrow.customs_charge = ((flt(efk) * flt(ptv)) / 100).toFixed(2);
            rrow.is_automatic = 1;
            refresh_field("customs_duties_analysis");
        }

        if (vat != 0) {
            var tcd = (flt(cduty) * flt(ptv)) / 100;
            var tr = (flt(antidump) * flt(ptv)) / 100;
            var tefk = (flt(efk) * flt(ptv)) / 100;
            var rrow = frm.add_child("customs_duties_analysis");
            rrow.hs_code = code;
            rrow.customs_charges_code = "B00";
            rrow.customs_charges_description = "VAT";
            rrow.way_of_payment_duties = "H";
            rrow.tax_base = (
                flt(tcd) +
                flt(tr) +
                flt(tefk) +
                flt(troyal) +
                flt(tagri) +
                flt(tv)
            ).toFixed(2);
            rrow.coefficient = flt(vat).toFixed(2);
            rrow.customs_charge = (
                ((flt(tcd) + flt(tr) + flt(tefk) + flt(troyal) + flt(tagri) + flt(tv)) *
                    flt(vat)) /
                100
            ).toFixed(2);
            rrow.is_automatic = 1;
            refresh_field("customs_duties_analysis");
        }

        totalfctotal =
            totalfctotal + flt(tcd) + flt(tr) + flt(tefk) + flt(troyal) + flt(tagri);
        totalfcvattotal =
            totalfcvattotal +
            ((flt(tcd) + flt(tr) + flt(tefk) + flt(troyal) + flt(tagri) + flt(tv)) *
                flt(vat)) /
            100;
        if (frm.doc.commodities_data[i].freight_is_paid_by_the_customer == 0) {
            freightfctotal =
                flt(freightfctotal) +
                flt(frm.doc.commodities_data[i].freight) *
                flt(frm.doc.commodities_data[i].freight_currency_rate);
        }
        if (frm.doc.commodities_data[i].insurance_is_paid_by_the_customer == 0) {
            insurancefctotal =
                flt(insurancefctotal) +
                flt(frm.doc.commodities_data[i].insurance) *
                flt(frm.doc.commodities_data[i].insurance_currency_rate);
        }
    }

    if (frm.doc.delivery_order != 0) {
        var rrow = frm.add_child("cost_analysis");
        rrow.billing_account = "Διατακτική - Delivery order";
        rrow.billing_account_description = "Delivery Order";
        rrow.billing_account_document = frm.doc.delivery_order;
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = frm.doc.delivery_order_net_price;
        rrow.vat = dvat;
        rrow.vat_value = (flt(frm.doc.delivery_order_net_price) * flt(dvat)) / 100;
        rrow.total_billing_value =
            (flt(frm.doc.delivery_order_net_price) * flt(dvat)) / 100 +
            flt(frm.doc.delivery_order_net_price);
        rrow.is_automatic = 1;
        refresh_field("cost_analysis");

        var rrow = frm.add_child("invoice_analysis");
        rrow.billing_account = "Διατακτική - Delivery order";
        rrow.billing_account_description = "Delivery Order";
        rrow.billing_account_document = frm.doc.delivery_order;
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = frm.doc.delivery_order_net_price;
        rrow.vat = dvat;
        rrow.vat_value = (flt(frm.doc.delivery_order_net_price) * flt(dvat)) / 100;
        rrow.total_billing_value =
            (flt(frm.doc.delivery_order_net_price) * flt(dvat)) / 100 +
            flt(frm.doc.delivery_order_net_price);
        rrow.is_automatic = 1;
        refresh_field("invoice_analysis");
    }

    if (freightfctotal > 0) {
        var rrow = frm.add_child("cost_analysis");
        rrow.billing_account =
            "Ναύλος εξωτερικής μεταφοράς - International freight";
        rrow.billing_account_description = "";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = freightfctotal;
        rrow.vat = 0;
        rrow.vat_value = "";
        rrow.total_billing_value = flt(freightfctotal);
        rrow.is_automatic = 1;
        refresh_field("cost_analysis");

        var rrow = frm.add_child("invoice_analysis");
        rrow.billing_account =
            "Ναύλος εξωτερικής μεταφοράς - International freight";
        rrow.billing_account_description = "";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = freightfctotal;
        rrow.vat = 0;
        rrow.vat_value = "";
        rrow.total_billing_value = flt(freightfctotal);
        rrow.is_automatic = 1;
        refresh_field("invoice_analysis");
    }

    if (insurancefctotal > 0) {
        var rrow = frm.add_child("cost_analysis");
        rrow.billing_account = "Ασφάλιστρα - Insurance fees";
        rrow.billing_account_description = "";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = insurancefctotal;
        rrow.vat = 0;
        rrow.vat_value = "";
        rrow.total_billing_value = flt(insurancefctotal);
        rrow.is_automatic = 1;
        refresh_field("cost_analysis");

        var rrow = frm.add_child("invoice_analysis");
        rrow.billing_account = "Ασφάλιστρα - Insurance fees";
        rrow.billing_account_description = "";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = insurancefctotal;
        rrow.vat = 0;
        rrow.vat_value = "";
        rrow.total_billing_value = flt(insurancefctotal);
        rrow.is_automatic = 1;
        refresh_field("invoice_analysis");
    }
    if (totalfcvattotal > 0) {
        var rrow = frm.add_child("cost_analysis");
        rrow.billing_account = "ΦΠΑ εισαγωγής - Import VAT";
        rrow.billing_account_description = "ΦΠΑ εισαγωγής - Import VAT";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = totalfcvattotal;
        rrow.vat = "0";
        rrow.vat_value = "0";
        rrow.total_billing_value = flt(totalfcvattotal);
        rrow.is_automatic = 1;
        refresh_field("cost_analysis");

        var rrow = frm.add_child("invoice_analysis");
        rrow.billing_account = "ΦΠΑ εισαγωγής - Import VAT";
        rrow.billing_account_description = "ΦΠΑ εισαγωγής - Import VAT";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = totalfcvattotal;
        rrow.vat = "0";
        rrow.vat_value = "0";
        rrow.total_billing_value = flt(totalfcvattotal);
        rrow.is_automatic = 1;
        refresh_field("invoice_analysis");

        frappe.model.set_value(
            d.doctype,
            d.name,
            "total_duties_and_vat",
            flt(totalfctotal) + flt(totalfcvattotal)
        );
    }
    if (totalfctotal > 0) {
        var rrow = frm.add_child("cost_analysis");
        rrow.billing_account = "Δασμοί - Duties";
        rrow.billing_account_description = "Δασμοί - Duties";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = totalfctotal;
        rrow.vat = "0";
        rrow.vat_value = "0";
        rrow.total_billing_value = flt(totalfctotal);
        rrow.is_automatic = 1;
        refresh_field("cost_analysis");

        var rrow = frm.add_child("invoice_analysis");
        rrow.billing_account = "Δασμοί - Duties";
        rrow.billing_account_description = "Δασμοί - Duties";
        rrow.billing_account_document = "";
        rrow.billing_account_notes = "";
        rrow.billing_quantity = "1";
        rrow.billing_value = totalfctotal;
        rrow.vat = "0";
        rrow.vat_value = "0";
        rrow.total_billing_value = flt(totalfctotal);
        rrow.is_automatic = 1;
        refresh_field("invoice_analysis");

        frappe.model.set_value(
            d.doctype,
            d.name,
            "total_duties_and_vat",
            flt(totalfctotal) + flt(totalfcvattotal)
        );
    }

    // frappe.call({
    //     method: "frappe.client.get",
    //     args: {
    //         doctype: "Item",
    //         filters: {
    //             name: ["=", "Παροχή Υπηρεσιών - Customs clearance fees"],
    //         },
    //     },
    //     freeze: true,
    //     callback: function (data) {
    //         console.log(data.message.taxes[0].tax_rate);
    //         var rrow = frm.add_child("invoice_analysis");
    //         rrow.billing_account = "Παροχή Υπηρεσιών - Customs clearance fees";
    //         rrow.billing_account_description = "Customs clearance fees";
    //         rrow.billing_account_document = "";
    //         rrow.billing_account_notes = "";
    //         rrow.billing_quantity = "1";
    //         rrow.billing_value = "100";
    //         rrow.vat = data.message.taxes[0].tax_rate;
    //         rrow.vat_value = data.message.taxes[0].tax_rate;
    //         rrow.total_billing_value = 100 + flt(data.message.taxes[0].tax_rate);
    //         rrow.is_automatic = 1;
    //         refresh_field("invoice_analysis");
    //     },
    // });
});

frappe.ui.form.on("Project", "clear_values", function (frm, cdt, cdn) {
    var a = frm.doc.customs_warehouse;
    var p = frm.doc;
    var fa = [];
    var ca = [];
    var cd = [];
    var cas = [];
    var ias = [];
    var ntd = [];

    for (var a = 0; a < frm.doc.financial_analysis.length; a++) {
        if (frm.doc.financial_analysis[a].is_automatic == 0) {
            fa.push(frm.doc.financial_analysis[a]);
        }
    }
    for (var b = 0; b < frm.doc.customs_attachments.length; b++) {
        if (frm.doc.customs_attachments[b].is_automatic == 0) {
            ca.push(frm.doc.customs_attachments[b]);
        }
    }

    // if(frm.doc.commodities_data[0].preferential_status != "") {
    for (var c = 0; c < frm.doc.customs_duties_analysis.length; c++) {
        if (frm.doc.customs_duties_analysis[c].is_automatic == 0) {
            cd.push(frm.doc.customs_duties_analysis[c]);
        }
    }
    for (var d = 0; d < frm.doc.cost_analysis.length; d++) {
        if (
            frm.doc.cost_analysis[d].is_automatic == 0 ||
            frm.doc.cost_analysis[d].payment_entry
        ) {
            cas.push(frm.doc.cost_analysis[d]);
            ntd.push(frm.doc.cost_analysis[d].billing_account);
        }
    }

    // }

    for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
        if (
            frm.doc.invoice_analysis[e].is_automatic == 0 ||
            $.inArray(frm.doc.invoice_analysis[e].billing_account, ntd) > -1
        ) {
            ias.push(frm.doc.invoice_analysis[e]);
        }
    }

    frm.doc.financial_analysis = [];
    frm.doc.customs_attachments = [];
    // if(frm.doc.commodities_data[0].preferential_status != "") {
    frm.doc.customs_duties_analysis = [];
    frm.doc.cost_analysis = [];

    // }
    frm.doc.invoice_analysis = [];

    refresh_field("financial_analysis");
    refresh_field("customs_attachments");
    refresh_field("customs_duties_analysis");
    refresh_field("cost_analysis");
    refresh_field("invoice_analysis");

    for (var a = 0; a < fa.length; a++) {
        var crow = frm.add_child("financial_analysis");
        crow.hs_code = fa[a].hs_code;
        crow.financial_data = fa[a].financial_data;
        crow.financial_data_value = fa[a].financial_data_value;
        crow.financial_currency = fa[a].financial_currency;
        crow.currency_rate = fa[a].currency_rate;
        crow.euro_total = fa[a].euro_total;
        refresh_field("financial_analysis");
    }

    for (var b = 0; b < ca.length; b++) {
        var orow = frm.add_child("customs_attachments");
        orow.hs_code = ca[b].hs_code;
        orow.document_code = ca[b].document_code;
        orow.customs_document_description = ca[b].customs_document_description;
        orow.document_number = ca[b].document_number;
        refresh_field("customs_attachments");
    }

    for (var c = 0; c < cd.length; c++) {
        var rrow = frm.add_child("customs_duties_analysis");
        rrow.hs_code = cd[c].hs_code;
        rrow.customs_charges_code = cd[c].customs_charges_code;
        rrow.customs_charges_description = cd[c].customs_charges_description;
        rrow.way_of_payment_duties = cd[c].way_of_payment_duties;
        rrow.tax_base = cd[c].tax_base;
        rrow.coefficient = cd[c].coefficient;
        rrow.customs_charge = cd[c].customs_charge;
        refresh_field("customs_duties_analysis");
    }

    for (var d = 0; d < cas.length; d++) {
        var rrow = frm.add_child("cost_analysis");
        rrow.billing_account = cas[d].billing_account;
        rrow.billing_account_description = cas[d].billing_account_description;
        rrow.billing_account_document = cas[d].billing_account_document;
        rrow.billing_account_notes = cas[d].billing_account_notes;
        rrow.billing_quantity = cas[d].billing_quantity;
        rrow.billing_value = cas[d].billing_value;
        rrow.vat = cas[d].vat;
        rrow.vat_value = cas[d].vat_value;
        rrow.total_billing_value = cas[d].total_billing_value;
        rrow.is_automatic = cas[d].is_automatic;
        rrow.is_registered = cas[d].is_registered;
        rrow.is_paid = cas[d].is_paid;
        rrow.payment_to = cas[d].payment_to;
        rrow.date_of_payment = cas[d].date_of_payment;
        rrow.mode_of_payment = cas[d].mode_of_payment;
        rrow.from_account = cas[d].from_account;
        rrow.to_account = cas[d].to_account;
        rrow.payment_entry = cas[d].payment_entry;
        rrow.payment_entry_created = cas[d].payment_entry_created;
        rrow.payment_entry_confirmed = cas[d].payment_entry_confirmed;
        rrow.container_guarantee = cas[d].container_guarantee;
        rrow.container_in_depot = cas[d].container_in_depot;
        refresh_field("cost_analysis");
    }

    for (var e = 0; e < ias.length; e++) {
        var rrow = frm.add_child("invoice_analysis");
        rrow.billing_account = ias[e].billing_account;
        rrow.billing_account_description = ias[e].billing_account_description;
        rrow.billing_account_document = ias[e].billing_account_document;
        rrow.billing_account_notes = ias[e].billing_account_notes;
        rrow.billing_quantity = ias[e].billing_quantity;
        rrow.billing_value = ias[e].billing_value;
        rrow.vat = ias[e].vat;
        rrow.vat_value = ias[e].vat_value;
        rrow.total_billing_value = ias[e].total_billing_value;
        rrow.is_automatic = ias[e].is_automatic;
        rrow.is_invoiced = ias[e].is_invoiced;
        rrow.ref_invoice_no = ias[e].ref_invoice_no;
        refresh_field("invoice_analysis");
    }

    refresh_field("financial_analysis");
    refresh_field("customs_attachments");
    refresh_field("customs_duties_analysis");
    refresh_field("cost_analysis");
    refresh_field("invoice_analysis");
});

cur_frm.add_fetch(
    "ocean_forwarder",
    "ocean_forwarder_agent",
    "ocean_forwarder_agent"
);

cur_frm.cscript.custom_date_of_customs_declaration = function (doc, cdt, cd) {
    cur_frm.set_value(
        "date_of_final_delivery_or_dispatch",
        doc.date_of_customs_declaration
    );
};

frappe.ui.form.on(
    "Container data",
    "container_number",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        d.container_number = d.container_number.toUpperCase();
        refresh_field("container_data");

        function ISO6346Check(con) {
            if (!con || con == "" || con.length != 11) {
                return false;
            }
            con = con.toUpperCase();
            var re = /^[A-Z]{4}\d{7}/;
            if (re.test(con)) {
                var sum = 0;
                for (i = 0; i < 10; i++) {
                    var n = con.substr(i, 1);
                    if (i < 4) {
                        n = "0123456789A?BCDEFGHIJK?LMNOPQRSTU?VWXYZ".indexOf(
                            con.substr(i, 1)
                        );
                    }
                    n *= Math.pow(2, i);
                    sum += n;
                }
                if (con.substr(0, 4) == "HLCU") {
                    sum -= 2;
                }
                sum %= 11;
                sum %= 10;
                //frappe.msgprint("Last digit should be "+sum);
                return sum == con.substr(10);
            } else {
                return false;
            }
        }

        if (ISO6346Check(d.container_number)) {
            $('input[data-fieldname="container_number"]').css(
                "background-color",
                "#98FB98"
            );
        } else {
            $('input[data-fieldname="container_number"]').css(
                "background-color",
                "#FFE4C4"
            );
            frappe.msgprint("Wrong!!! Container Number is wrong as per ISO6346.");
        }
    }
);

frappe.ui.form.on("Container data", "container_seal", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    d.container_seal = d.container_seal.toUpperCase();

    refresh_field("container_data");
});

cur_frm.cscript.delivery_order = function (doc, cdt, cd) {
    var c = doc.delivery_order.toUpperCase();
    cur_frm.set_value("delivery_order", c);
};

cur_frm.cscript.house_bol = function (doc, cdt, cd) {
    var b = doc.house_bol.toUpperCase();
    cur_frm.set_value("house_bol", b);
};

cur_frm.cscript.master_bol_or_cmr = function (doc, cdt, cd) {
    var a = doc.master_bol_or_cmr.toUpperCase();
    cur_frm.set_value("master_bol_or_cmr", a);
};

frappe.ui.form.on("Commodities data", "net_weight", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    if (flt(d.net_weight) > flt(d.gross_weight)) {
        frappe.model.set_value(d.doctype, d.name, "net_weight", "0");
        msgprint(
            "Net weight should always be smaller than or equal to gross weight, Please revise"
        );
    }
});

cur_frm.cscript.customs_warehouse = function (doc, cdt, cd) {
    cur_frm.set_value("place_of_customs_declaration", doc.customs_warehouse);
    cur_frm.add_fetch(
        "customs_warehouse",
        "customs_warehouse_code",
        "customs_warehouse_code"
    );
};

frappe.ui.form.on("Cost analysis", "billing_value", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var q = flt(d.billing_quantity);
    var v = flt(d.billing_value);
    var vt = flt(d.vat);
    var tvt, total;

    tvt = (flt(q) * flt(v) * flt(vt)) / 100;
    total = flt(q) * flt(v) + flt(tvt);
    frappe.model.set_value(d.doctype, d.name, "vat_value", tvt);
    frappe.model.set_value(d.doctype, d.name, "total_billing_value", total);
});

frappe.ui.form.on(
    "Invoice analysis",
    "billing_value",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        var q = flt(d.billing_quantity);
        var v = flt(d.billing_value);
        var vt = flt(d.vat);
        var tvt, total;

        tvt = (flt(q) * flt(v) * flt(vt)) / 100;
        total = flt(q) * flt(v) + flt(tvt);
        frappe.model.set_value(d.doctype, d.name, "vat_value", tvt);
        frappe.model.set_value(d.doctype, d.name, "total_billing_value", total);
        frappe.model.set_value(
            p.doctype,
            p.name,
            "total_invoice_value",
            d.total_billing_value
        );
    }
);

frappe.ui.form.on("Cost analysis", "vat", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var q = flt(d.billing_quantity);
    var v = flt(d.billing_value);
    var vt = flt(d.vat);
    var tvt, total;

    tvt = (flt(q) * flt(v) * flt(vt)) / 100;
    total = flt(q) * flt(v) + flt(tvt);
    frappe.model.set_value(d.doctype, d.name, "vat_value", tvt);
    frappe.model.set_value(d.doctype, d.name, "total_billing_value", total);
});

frappe.ui.form.on("Invoice analysis", "vat", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var q = flt(d.billing_quantity);
    var v = flt(d.billing_value);
    var vt = flt(d.vat);
    var tvt, total;

    tvt = (flt(q) * flt(v) * flt(vt)) / 100;
    total = flt(q) * flt(v) + flt(tvt);
    frappe.model.set_value(d.doctype, d.name, "vat_value", tvt);
    frappe.model.set_value(d.doctype, d.name, "total_billing_value", total);
    frappe.model.set_value(
        p.doctype,
        p.name,
        "total_invoice_value",
        d.total_billing_value
    );
});

frappe.ui.form.on("Cost analysis", "delete_row", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    for (var i = 0; i < frm.doc.invoice_analysis.length; i++) {
        if (frm.doc.invoice_analysis[i].billing_account == d.billing_account) {
            cur_frm.get_field("invoice_analysis").grid.grid_rows[i].remove();
        }
    }
    for (var i = 0; i < frm.doc.cost_analysis.length; i++) {
        if (frm.doc.cost_analysis[i].billing_account == d.billing_account) {
            cur_frm.get_field("cost_analysis").grid.grid_rows[i].remove();
        }
    }
});

frappe.ui.form.on("Cost analysis", "vat_value", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    total = d.billing_value + d.vat_value;
    frappe.model.set_value(d.doctype, d.name, "total_billing_value", total);
});

frappe.ui.form.on("Invoice analysis", "vat_value", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    total = d.billing_value + d.vat_value;
    frappe.model.set_value(d.doctype, d.name, "total_billing_value", total);
});

frappe.ui.form.on(
    "Cost analysis",
    "total_billing_value",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item",
                fieldname: "is_attributable",
                filters: {
                    name: ["=", d.billing_account],
                },
            },
            freeze: true,
            callback: function (data) {
                var pointer = "";
                if (data.message.is_attributable == 1) {
                    for (var i = 0; i < frm.doc.invoice_analysis.length; i++) {
                        if (
                            frm.doc.invoice_analysis[i].billing_account == d.billing_account
                        ) {
                            pointer = i;
                        }
                    }

                    if (pointer != "") {
                        console.log("Cost Already Exists");
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.billing_account = d.billing_account;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.billing_account_description = d.billing_account_description;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.billing_account_document = d.billing_account_document;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.billing_account_notes = d.billing_account_notes;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.billing_quantity = d.billing_quantity;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.billing_value = d.billing_value;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.vat = d.vat;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.vat_value = d.vat_value;
                        cur_frm.get_field("invoice_analysis").grid.grid_rows[
                            pointer
                        ].doc.total_billing_value = d.total_billing_value;
                        refresh_field("invoice_analysis");
                    } else {
                        var rrow = frm.add_child("invoice_analysis");
                        rrow.billing_account = d.billing_account;
                        rrow.billing_account_description = d.billing_account_description;
                        rrow.billing_account_document = d.billing_account_document;
                        rrow.billing_account_notes = d.billing_account_notes;
                        rrow.billing_quantity = d.billing_quantity;
                        rrow.billing_value = d.billing_value;
                        rrow.vat = d.vat;
                        rrow.vat_value = d.vat_value;
                        rrow.total_billing_value = d.total_billing_value;
                        refresh_field("invoice_analysis");
                    }
                }
            },
        });
    }
);

frappe.ui.form.on("Project", "calculate", function (frm, cdt, cdn) {
    var p = frm.doc;
    var cost_total = 0;
    var invoice_total = 0;
    var finan_total = 0;
    var c = 0;
    var q = 0;
    var billing_cost_total = 0;
    var billing_invoice_total = 0;
    var billing_final_total = 0;

    console.log("calcualte pressed");

    for (var i = 0; i < frm.doc.cost_analysis.length; i++) {
        if (frm.doc.cost_analysis[i].container_guarantee != 1) {
            cost_total =
                flt(cost_total) + flt(frm.doc.cost_analysis[i].total_billing_value);
            billing_cost_total =
                flt(billing_cost_total) + flt(frm.doc.cost_analysis[i].billing_value);
        }
    }
    for (var j = 0; j < frm.doc.invoice_analysis.length; j++) {
        invoice_total =
            flt(invoice_total) + flt(frm.doc.invoice_analysis[j].total_billing_value);
        billing_invoice_total =
            flt(billing_invoice_total) +
            flt(frm.doc.invoice_analysis[j].billing_value);
    }

    final_total = flt(invoice_total) - flt(cost_total);

    billing_final_total = flt(billing_invoice_total) - flt(billing_cost_total);
    console.log(billing_final_total, invoice_total, invoice_total);
    frappe.model.set_value(
        p.doctype,
        p.name,
        "final_outcome",
        billing_final_total
    );
    frappe.model.set_value(p.doctype, p.name, "total_cost_value", cost_total);
    frappe.model.set_value(
        p.doctype,
        p.name,
        "total_billing_value",
        invoice_total
    );
    frappe.model.set_value(
        p.doctype,
        p.name,
        "total_outstanding_payment",
        invoice_total
    );

    // console.log(invoice_total);
    // console.log(cost_total);

    // var today = new Date();
    // var dd = today.getDate();
    // var mm = today.getMonth() + 1; //January is 0!
    // var yyyy = today.getFullYear();
    // var lyyyy = yyyy - 1;

    // if(dd < 10) {
    //     dd = '0' + dd
    // }

    // if(mm < 10) {
    //     mm = '0' + mm
    // }

    // today = dd + '/' + mm + '/' + yyyy;
    // ltoday = dd + '/' + mm + '/' + lyyyy;
    // console.log(today + " " + lyyyy);

    // frappe.call({
    //     "method": "frappe.client.get_list",
    //     args: {
    //         doctype: "Project",
    //         filters: {
    //             date_of_customs_declaration: ["<", today],
    //             date_of_customs_declaration: [">", ltoday]
    //         },
    //         order_by: "name",
    //         limit_page_length: 500
    //     },
    //     freeze: true,
    //     callback: function(data) {
    //         console.log(data);
    //         q = data.message.length;
    //         frappe.model.set_value(p.doctype, p.name, "xfactor", q);
    //         for(var i = 0; i < q; i++) {
    //             var getname = data.message[i].name;
    //             frappe.call({
    //                 "method": "frappe.client.get_value",
    //                 args: {
    //                     doctype: "Project",
    //                     fieldname: "final_outcome",
    //                     filters: {
    //                         name: ["=", getname]
    //                     }
    //                 },
    //                 freeze: true,
    //                 callback: function(data) {
    //                     console.log(data.message.final_outcome);
    //                     c = c + flt(data.message.final_outcome);
    //                     frappe.model.set_value(p.doctype, p.name, "average_malco_year_result", c);

    //                     x = frm.doc.average_malco_year_result;
    //                     y = frm.doc.xfactor;
    //                     console.log(x);
    //                     avg = flt(x) / flt(y);
    //                     frappe.model.set_value(p.doctype, p.name, "average_malco_year_result", avg);
    //                 }
    //             })

    //         }

    //     }
    // })
});

frappe.ui.form.on("Project", "create_quotation", function (frm, cdt, cdn) {
    var p = frm.doc;

    q = new Array();
    ia = [];
    for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
        q[e] = {
            item_code: frm.doc.invoice_analysis[e].billing_account,
            item_name: frm.doc.invoice_analysis[e].billing_account,
            description: frm.doc.invoice_analysis[e].billing_account,
            qty: frm.doc.invoice_analysis[e].billing_quantity,
            rate: frm.doc.invoice_analysis[e].billing_value,
            UOM: "Nos",
            vat: frm.doc.invoice_analysis[e].vat_value,
            amount: frm.doc.invoice_analysis[e].total_billing_value,
        };

        ia.push(frm.doc.invoice_analysis[e]);
    }

    var vatind = 0;
    var vatfinal = 0;
    var vatimport = 0;
    var exvat = 0;
    for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
        //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined"){
        //	vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
        //}
        //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined" && frm.doc.invoice_analysis[e].billing_account == "ΦΠΑ εισαγωγής - Import VAT"){
        //	vatimport = frm.doc.invoice_analysis[e].total_billing_value;
        //}
        if (
            frm.doc.invoice_analysis[e].is_invoiced == 0 &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ εισαγωγής - Import VAT" &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT"
        ) {
            vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
        }
        if (
            frm.doc.invoice_analysis[e].is_invoiced == 0 &&
            (frm.doc.invoice_analysis[e].billing_account ==
                "ΦΠΑ εισαγωγής - Import VAT" ||
                frm.doc.invoice_analysis[e].billing_account ==
                "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT")
        ) {
            vatimport = frm.doc.invoice_analysis[e].total_billing_value;
        }
        if (
            frm.doc.invoice_analysis[e].is_invoiced == 0 &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ εισαγωγής - Import VAT" &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT"
        ) {
            tempcal =
                flt(frm.doc.invoice_analysis[e].billing_value) *
                flt(frm.doc.invoice_analysis[e].billing_quantity);
            exvat = exvat + tempcal;
        }
    }
    vatfinal = vatind + vatimport + exvat;
    //console.log(vatind);
    //console.log(vatimport);
    //console.log(vatfinal);
    //console.log(ia);

    if (q.length > 0) {
        t = new Array();
        t[0] = {
            charge_type: "On Net Total",
            account_head: "VAT - MalCo",
            cost_center: "Main - MalCo",
            rate: "0",
            description: "VAT",
        };

        frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: {
                    doctype: "Quotation",
                    quotation_to: "Customer",
                    customer: p.invoiced_to_payer,
                    customer_name: p.invoiced_to_payer,
                    territory: "All Territories",
                    items: q,
                    taxes_and_charges: "VAT - Greece",
                    taxes: t,
                    project_reference: p.project_name,
                    project: p.project_name,
                    project_cost_total: exvat,
                    import_vat: vatimport,
                    vat: vatind,
                    project_grand_total: vatfinal,
                    quotation_data: ia,
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data.message.name);
                frappe.model.set_value(p.doctype, p.name, "is_quotation_created", 1);
                frappe.model.set_value(
                    p.doctype,
                    p.name,
                    "quotation_no",
                    data.message.name
                );
            },
        });
    }
    if (q.length == 0) {
        msgprint("Please add charges to invoice analysis table");
    }
});

cur_frm.cscript.custom_is_quotation_created = function (doc, cdt, cd) {
    if (doc.is_quotation_created == 1) {
        cur_frm.save();
    }
};

frappe.ui.form.on("Project", "confirm_quotation", function (frm, cdt, cdn) {
    var p = frm.doc;
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Quotation",
            filters: {
                name: ["=", p.quotation_no],
            },
        },
        freeze: true,
        callback: function (data) {
            data.message["doctype"] = "Quotation";

            frappe.call({
                method: "frappe.client.submit",
                args: {
                    doc: data.message,
                },
                freeze: true,
                callback: function (res) {
                    //frappe.model.set_value(p.doctype, p.name, "quotation_confirmed", 1);
                    console.log(res);
                    setTimeout(function () {
                        frappe.model.set_value(p.doctype, p.name, "quotation_confirmed", 1);
                    }, 3000);
                },
            });
        },
    });
});

cur_frm.cscript.custom_quotation_confirmed = function (doc, cdt, cd) {
    if (doc.quotation_confirmed == 1) {
        cur_frm.save();
    }
    if (doc.quotation_confirmed == 0) {
        cur_frm.save();
    }
};

frappe.ui.form.on("Project", "cancel_quotation", function (frm, cdt, cdn) {
    var p = frm.doc;

    frappe.call({
        method: "frappe.client.cancel",
        args: {
            doctype: "Quotation",
            name: p.quotation_no,
        },
        freeze: true,
        callback: function (data) {
            setTimeout(function () {
                frappe.model.set_value(p.doctype, p.name, "quotation_confirmed", 0);
                frappe.model.set_value(p.doctype, p.name, "is_quotation_created", 0);
                frappe.model.set_value(p.doctype, p.name, "quotation_no", "");
            }, 3000);
        },
    });
});

frappe.ui.form.on("Project", "create_sales_order", function (frm, cdt, cdn) {
    var p = frm.doc;
    if (p.quotation_accepted == 0) {
        msgprint("Please accept quotation first.");
    }
    if (p.quotation_accepted == 1) {
        var vatind = 0;
        var vatfinal = 0;
        var vatimport = 0;
        var exvat = 0;
        ia = [];
        for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
            //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined"){
            //	vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
            //}
            //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined" && frm.doc.invoice_analysis[e].billing_account == "ΦΠΑ εισαγωγής - Import VAT"){
            //	vatimport = frm.doc.invoice_analysis[e].total_billing_value;
            //}
            if (
                frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ εισαγωγής - Import VAT" &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT"
            ) {
                vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
            }
            if (
                frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                (frm.doc.invoice_analysis[e].billing_account ==
                    "ΦΠΑ εισαγωγής - Import VAT" ||
                    frm.doc.invoice_analysis[e].billing_account ==
                    "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT")
            ) {
                vatimport = frm.doc.invoice_analysis[e].total_billing_value;
            }
            if (
                frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ εισαγωγής - Import VAT" &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT"
            ) {
                tempcal =
                    flt(frm.doc.invoice_analysis[e].billing_value) *
                    flt(frm.doc.invoice_analysis[e].billing_quantity);
                exvat = exvat + tempcal;
            }
        }
        vatfinal = vatind + vatimport + exvat;

        q = new Array();
        for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
            q[e] = {
                item_code: frm.doc.invoice_analysis[e].billing_account,
                item_name: frm.doc.invoice_analysis[e].billing_account,
                delivery_date: frm.doc.date_of_final_delivery_or_dispatch,
                description: frm.doc.invoice_analysis[e].billing_account,
                qty: frm.doc.invoice_analysis[e].billing_quantity,
                rate: frm.doc.invoice_analysis[e].billing_value,
                vat_value: frm.doc.invoice_analysis[e].vat_value,
                UOM: "Nos",
                amount: frm.doc.invoice_analysis[e].total_billing_value,
                prevdoc_docname: p.quotation_no,
            };
            ia.push(frm.doc.invoice_analysis[e]);
        }

        console.log(q);
        t = new Array();
        t[0] = {
            charge_type: "On Net Total",
            account_head: "VAT - MalCo",
            cost_center: "Main - MalCo",
            rate: "0",
            description: "VAT",
        };

        frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: {
                    doctype: "Sales Order",
                    customer: p.invoiced_to_payer,
                    customer_name: p.invoiced_to_payer,
                    trasaction_date: p.eta_or_etd,
                    delivery_date: p.date_of_final_delivery_or_dispatch,
                    order_type: "Sales",
                    territory: "All Territories",
                    items: q,
                    taxes_and_charges: "VAT - Greece",
                    taxes: t,
                    project_reference: p.project_name,
                    project: p.project_name,
                    project_cost_total: exvat,
                    import_vat: vatimport,
                    vat: vatind,
                    project_grand_total: vatfinal,
                    quotation_data: ia,
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data.message.name);
                frappe.model.set_value(p.doctype, p.name, "is_sales_order_created", 1);
                frappe.model.set_value(
                    p.doctype,
                    p.name,
                    "sales_order_no",
                    data.message.name
                );
            },
        });
    }
});

cur_frm.cscript.custom_is_sales_order_created = function (doc, cdt, cd) {
    if (doc.is_sales_order_created == 1) {
        cur_frm.save();
    }
};

frappe.ui.form.on("Project", "confirm_sales_order", function (frm, cdt, cdn) {
    var p = frm.doc;
    //cur_frm.save();
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Sales Order",
            filters: {
                name: ["=", p.sales_order_no],
            },
        },
        freeze: true,
        callback: function (data) {
            data.message["doctype"] = "Sales Order";

            frappe.call({
                method: "frappe.client.submit",
                args: {
                    doc: data.message,
                },
                freeze: true,
                callback: function (data) {
                    setTimeout(function () {
                        frappe.model.set_value(
                            p.doctype,
                            p.name,
                            "sales_order_confirmed",
                            1
                        );
                    }, 3000);
                },
            });
        },
    });
});

cur_frm.cscript.custom_sales_order_confirmed = function (doc, cdt, cd) {
    if (doc.sales_order_confirmed == 1) {
        cur_frm.save();
    }
    if (doc.sales_order_confirmed == 0) {
        cur_frm.save();
    }
};

frappe.ui.form.on("Project", "cancel_sales_order", function (frm, cdt, cdn) {
    var p = frm.doc;
    //cur_frm.save();
    frappe.call({
        method: "frappe.client.cancel",
        args: {
            doctype: "Sales Order",
            name: p.sales_order_no,
        },
        freeze: true,
        callback: function (data) {
            setTimeout(function () {
                frappe.model.set_value(p.doctype, p.name, "sales_order_confirmed", 0);
                frappe.model.set_value(p.doctype, p.name, "is_sales_order_created", 0);
                frappe.model.set_value(p.doctype, p.name, "sales_order_no", "");
            }, 3000);
        },
    });
});

frappe.ui.form.on("Project", "create_delivery_note", function (frm, cdt, cdn) {
    var p = frm.doc;

    cur_frm.set_df_property("delivery_note_status", "hidden", 0);

    if (p.sales_order_confirmed == 1 || p.skip_primary_workflow == 1) {
        q = new Array();
        for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
            q[e] = {
                item_code: frm.doc.invoice_analysis[e].billing_account,
                item_name: frm.doc.invoice_analysis[e].billing_account,
                description: frm.doc.invoice_analysis[e].billing_account,
                qty: frm.doc.invoice_analysis[e].billing_quantity,
                rate: frm.doc.invoice_analysis[e].billing_value,
                UOM: "Nos",
                amount: frm.doc.invoice_analysis[e].total_billing_value,
            };
        }

        console.log(q);
        t = new Array();
        t[0] = {
            charge_type: "On Net Total",
            account_head: "VAT - MalCo",
            cost_center: "Main - MalCo",
            rate: "0",
            description: "VAT",
        };
        c = new Array();
        if (p.container == 1) {
            if (p.container_data.length == 1) {
                for (var e = 0; e < frm.doc.commodities_data.length; e++) {
                    c[e] = {
                        container_number: p.container_data[0].container_number,
                        container_size: p.container_data[0].container_size,
                        container_seal: p.container_data[0].container_seal,
                        malco_seal: p.container_data[0].malco_seal,
                        container_po_number: p.container_data[0].container_po_number,
                        commodity: p.commodities_data[e].hs_code_commercial_name_gr,
                        container_pieces: p.commodities_data[e].items,
                        container_gross_weight: p.commodities_data[e].gross_weight,
                        container_net_weight: p.commodities_data[e].net_weight,
                    };
                }
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Delivery Note",
                            customer: p.customer,
                            place_of_dispatch: p.place_of_customs_declaration,
                            shipping_address_name: p.physical_delivery,
                            territory: "All Territories",
                            items: q,
                            taxes_and_charges: "VAT - Greece",
                            taxes: t,
                            commodities_data: c,
                            project: p.project_name,
                            project_reference: p.project_name,
                            project: p.project_name,
                        },
                    },
                    freeze: true,
                    callback: function (data) {
                        console.log(data.message.name);
                        //frappe.model.set_value(p.doctype, p.name, "is_delivery_note_created", 1);
                        //frappe.model.set_value(p.doctype, p.name, "delivery_note_no", data.message.name);
                        var irow = frm.add_child("delivery_note_status");
                        irow.delivery_note_no = data.message.name;
                        irow.delivery_note_created = 1;
                        refresh_field("delivery_note_status");
                        cur_frm.save();
                    },
                });
            }

            if (p.container_data.length > 1) {
                for (var e = 0; e < frm.doc.container_data.length; e++) {
                    c = new Array();
                    console.log(e);
                    c[0] = {
                        container_number: p.container_data[e].container_number,
                        container_size: p.container_data[e].container_size,
                        container_seal: p.container_data[e].container_seal,
                        malco_seal: p.container_data[e].malco_seal,
                        container_po_number: p.container_data[e].container_po_number,
                        commodity: p.container_data[e].commodity,
                        container_pieces: p.container_data[e].container_pieces,
                        container_gross_weight: p.container_data[e].container_gross_weight,
                        container_net_weight: p.container_data[e].container_net_weight,
                    };
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Delivery Note",
                                customer: p.customer,
                                place_of_dispatch: p.place_of_customs_declaration,
                                shipping_address_name: p.physical_delivery,
                                territory: "All Territories",
                                items: q,
                                taxes_and_charges: "VAT - Greece",
                                taxes: t,
                                commodities_data: c,
                                project: p.project_name,
                                project_reference: p.project_name,
                                project: p.project_name,
                            },
                        },
                        freeze: true,
                        callback: function (data) {
                            console.log(data.message.name);
                            //frappe.model.set_value(p.doctype, p.name, "is_delivery_note_created", 1);
                            //frappe.model.set_value(p.doctype, p.name, "delivery_note_no", data.message.name);
                            var irow = frm.add_child("delivery_note_status");
                            irow.delivery_note_no = data.message.name;
                            irow.delivery_note_created = 1;
                            refresh_field("delivery_note_status");
                        },
                    });
                }
            }
        }
        if (p.container == 0) {
            for (var e = 0; e < frm.doc.commodities_data.length; e++) {
                c[e] = {
                    container_number: "",
                    container_size: "",
                    container_seal: "",
                    malco_seal: "",
                    container_po_number: "",
                    commodity: p.commodities_data[e].hs_code_description,
                    container_pieces: p.commodities_data[e].items,
                    container_gross_weight: p.commodities_data[e].gross_weight,
                    container_net_weight: p.commodities_data[e].net_weight,
                };
            }
            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        doctype: "Delivery Note",
                        customer: p.customer,
                        place_of_dispatch: p.place_of_customs_declaration,
                        shipping_address_name: p.physical_delivery,
                        territory: "All Territories",
                        items: q,
                        taxes_and_charges: "VAT - Greece",
                        taxes: t,
                        commodities_data: c,
                        project: p.project_name,
                        project_reference: p.project_name,
                        project: p.project_name,
                    },
                },
                freeze: true,
                callback: function (data) {
                    console.log(data.message.name);
                    //frappe.model.set_value(p.doctype, p.name, "is_delivery_note_created", 1);
                    //frappe.model.set_value(p.doctype, p.name, "delivery_note_no", data.message.name);
                    var irow = frm.add_child("delivery_note_status");
                    irow.delivery_note_no = data.message.name;
                    irow.delivery_note_created = 1;
                    refresh_field("delivery_note_status");
                    cur_frm.save();
                },
            });
        }
    }
    if (p.sales_order_confirmed == 0 && p.skip_primary_workflow == 0) {
        msgprint("Please create and confirm Sales Order first");
    }
});

frappe.ui.form.on(
    "Delivery note status",
    "delivery_note_created",
    function (frm, cdt, cdn) {
        cur_frm.save();
    }
);

frappe.ui.form.on(
    "Delivery note status",
    "confirm_delivery_note",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        //cur_frm.save();
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Delivery Note",
                filters: {
                    name: ["=", d.delivery_note_no],
                },
            },
            freeze: true,
            callback: function (data) {
                data.message["doctype"] = "Delivery Note";

                frappe.call({
                    method: "frappe.client.submit",
                    args: {
                        doc: data.message,
                    },
                    freeze: true,
                    callback: function (data) {
                        setTimeout(function () {
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                "delivery_note_confirmed",
                                1
                            );
                        }, 3000);
                    },
                });
            },
        });
    }
);

frappe.ui.form.on(
    "Delivery note status",
    "delivery_note_confirmed",
    function (frm, cdt, cdn) {
        cur_frm.save();
    }
);

frappe.ui.form.on(
    "Delivery note status",
    "cancel_delivery_note",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        //cur_frm.save();

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customer",
                fieldname: "customer_group",
                filters: {
                    name: ["=", p.customer],
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data.message.customer_group);

                if (data.message.customer_group == "Individual") {
                    frappe.msgprint("Creating a return Delivery Note.... Please wait");
                    frappe.call({
                        method: "malco_erpnext.malco_erpnext.malco_erpnext.return_invoice",
                        args: {
                            doctype: "Delivery Note",
                            name: d.delivery_note_no,
                        },
                        freeze: true,
                        callback: function (res1) {
                            setTimeout(function () {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "delivery_note_confirmed",
                                    0
                                );
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "delivery_note_created",
                                    0
                                );
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "delivery_note_cancelled",
                                    1
                                );
                                frappe.msgprint(
                                    "Creating a return Delivery Note.... Please wait"
                                );
                            }, 3000);
                        },
                    });
                } else {
                    frappe.call({
                        method: "frappe.client.cancel",
                        args: {
                            doctype: "Delivery Note",
                            name: d.delivery_note_no,
                        },
                        freeze: true,
                        callback: function (res2) {
                            setTimeout(function () {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "delivery_note_confirmed",
                                    0
                                );
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "delivery_note_created",
                                    0
                                );
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "delivery_note_cancelled",
                                    1
                                );
                            }, 3000);
                        },
                    });
                }
            },
        });
    }
);

frappe.ui.form.on("Project", "create_invoice", function (frm, cdt, cdn) {
    var p = frm.doc;
    var namseries = "SINV-";

    cur_frm.set_df_property("invoicing_status", "hidden", 0);

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Customer",
            fieldname: "customer_group",
            filters: {
                name: ["=", p.customer],
            },
        },
        async: false,
        callback: function (data) {
            console.log(data.message.customer_group);
            if (data.message.customer_group == "Individual") {
                namseries = "RCPT-";
            }
        }
    });

    if (p.sales_order_confirmed == 1 || p.skip_primary_workflow == 1) {
        var d = locals[cdt][cdn];
        var x = 0;

        var vatind = 0;
        var vatfinal = 0;
        var vatimport = 0;
        var exvat = 0;
        for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
            //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined"){
            //	vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
            //}
            //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined" && frm.doc.invoice_analysis[e].billing_account == "ΦΠΑ εισαγωγής - Import VAT"){
            //	vatimport = frm.doc.invoice_analysis[e].total_billing_value;
            //}
            if (
                frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ εισαγωγής - Import VAT" &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT" &&
                frm.doc.invoice_analysis[e].billing_account_document != "undefined"
            ) {
                vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
            }
            if (
                frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                (frm.doc.invoice_analysis[e].billing_account ==
                    "ΦΠΑ εισαγωγής - Import VAT" ||
                    frm.doc.invoice_analysis[e].billing_account ==
                    "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT") &&
                frm.doc.invoice_analysis[e].billing_account_document != "undefined"
            ) {
                vatimport = vatimport + frm.doc.invoice_analysis[e].total_billing_value;
            }
            if (
                frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ εισαγωγής - Import VAT" &&
                frm.doc.invoice_analysis[e].billing_account !=
                "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT" &&
                frm.doc.invoice_analysis[e].billing_account_document != "undefined"
            ) {
                tempcal =
                    flt(frm.doc.invoice_analysis[e].billing_value) *
                    flt(frm.doc.invoice_analysis[e].billing_quantity);
                exvat = exvat + tempcal;
            }
        }
        vatfinal = vatind + vatimport + exvat;
        //console.log(vatind);
        //console.log(vatimport);
        //console.log(vatfinal);

        for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
            if (frm.doc.invoice_analysis[e].billing_account_document == "undefined") {
                x = x + 1;
            }
        }
        var gatemsg =
            "There are " +
            x +
            " charges which are undefined, do you want to continue?";

        if (x == 0) {
            gatemsg = "Do you want to continue?";
        }

        if (confirm(gatemsg)) {
            q = new Array();
            ia = [];
            ecounter = 0;
            for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                if (
                    frm.doc.invoice_analysis[e].is_invoiced == 0 &&
                    frm.doc.invoice_analysis[e].billing_account_document != "undefined"
                ) {
                    q[ecounter] = {
                        item_code: frm.doc.invoice_analysis[e].billing_account,
                        item_name: frm.doc.invoice_analysis[e].billing_account,
                        description: frm.doc.invoice_analysis[e].billing_account,
                        qty: frm.doc.invoice_analysis[e].billing_quantity,
                        rate: frm.doc.invoice_analysis[e].billing_value,
                        UOM: "Nos",
                        amount: frm.doc.invoice_analysis[e].total_billing_value,
                        vat_value: frm.doc.invoice_analysis[e].vat_value,
                        against_sales_order: p.sales_order_no,
                    };
                    frm.doc.invoice_analysis[e].is_invoiced = 1;
                    ia.push(frm.doc.invoice_analysis[e]);
                    ecounter = ecounter + 1;
                }
            }

            plist = new Array();
            plist[0] = {
                project_reference: p.project_name,
            };

            console.log(q);
            if (q.length > 0) {
                t = new Array();
                t[0] = {
                    //"charge_type":"On Net Total",
                    charge_type: "Actual",
                    account_head: "VAT - MalCo",
                    cost_center: "Main - MalCo",
                    //"rate":"0",
                    tax_amount: vatind,
                    description: "VAT",
                };

                if (p.payment_type == "Advance payment" && p.invoice_no == "") {
                    a = new Array();
                    // a[0] = {
                    // 		"reference_type": "Journal Entry",
                    // 		"reference_name": p.payment_voucher_no,
                    // 		"advance_amount":p.current_payment,
                    // 		"remarks":"Reference #"+p.payment_reference+" dated "+p.payment_reference_date+" € "+p.current_payment+" against Sales Order "+p.sales_order_no,
                    // 		"allocated_amount":p.current_payment
                    // 		};

                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Sales Invoice",
                                naming_series: namseries,
                                customer: p.invoiced_to_payer,
                                customer_name: p.invoiced_to_payer,
                                commercial_invoice_po_number: p.commercial_invoice_po_number,
                                territory: "All Territories",
                                debit_to: "Debtors - MalCo",
                                items: q,
                                //"taxes_and_charges": "VAT - Greece",
                                taxes: t,
                                //"advances": a,
                                project_reference: p.project_name,
                                project: p.project_name,
                                project_reference_list: plist,
                                project_cost_total: exvat,
                                import_vat: vatimport,
                                vat: vatind,
                                project_grand_total: vatfinal,
                                quotation_data: ia,
                                mrn: p.mrn
                            },
                        },
                        freeze: true,
                        callback: function (data) {
                            console.log(data.message.name);
                            frappe.model.set_value(p.doctype, p.name, "combined_invoice", 0);
                            //frappe.model.set_value(p.doctype, p.name, "invoice_no", data.message.name);

                            var irow = frm.add_child("invoicing_status");
                            irow.invoice_no = data.message.name;
                            irow.invoice_created = 1;
                            refresh_field("invoicing_status");

                            for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                                if (frm.doc.invoice_analysis[e].is_invoiced == 1) {
                                    frm.doc.invoice_analysis[e].ref_invoice_no =
                                        data.message.name;
                                }
                            }
                            cur_frm.save();
                        },
                    });
                }

                if (
                    p.payment_type == "No advance payment" ||
                    p.payment_type == "Skip payment" ||
                    p.invoice_no != ""
                ) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Sales Invoice",
                                naming_series: namseries,
                                customer: p.invoiced_to_payer,
                                customer_name: p.invoiced_to_payer,
                                commercial_invoice_po_number: p.commercial_invoice_po_number,
                                territory: "All Territories",
                                debit_to: "Debtors - MalCo",
                                items: q,
                                //"taxes_and_charges": "VAT - Greece",
                                taxes: t,
                                project_reference: p.project_name,
                                project: p.project_name,
                                project_reference_list: plist,
                                project_cost_total: exvat,
                                import_vat: vatimport,
                                vat: vatind,
                                project_grand_total: vatfinal,
                                quotation_data: ia,
                                mrn: p.mrn
                            },
                        },
                        freeze: true,
                        callback: function (data) {
                            console.log(data.message.name);
                            frappe.model.set_value(p.doctype, p.name, "combined_invoice", 0);
                            //frappe.model.set_value(p.doctype, p.name, "invoice_no", data.message.name);

                            var irow = frm.add_child("invoicing_status");
                            irow.invoice_no = data.message.name;
                            irow.invoice_created = 1;
                            refresh_field("invoicing_status");

                            for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                                if (frm.doc.invoice_analysis[e].is_invoiced == 1) {
                                    frm.doc.invoice_analysis[e].ref_invoice_no =
                                        data.message.name;
                                }
                            }
                            cur_frm.save();
                        },
                    });
                }
            }
            if (q.length == 0) {
                msgprint("It seems that all charges are invoiced. Please check.");
            }
            // Save it!
        } else {
            // Do nothing!
        }
    }
    if (p.sales_order_confirmed == 0 && p.skip_primary_workflow == 0) {
        msgprint("Please create and confirm Sales Order first");
    }
});

frappe.ui.form.on(
    "Invoicing status",
    "invoice_created",
    function (frm, cdt, cdn) {
        cur_frm.save();
    }
);

frappe.ui.form.on("Project", "invoicing_status", function (frm, cdt, cdn) {
    cur_frm.save();
});

frappe.ui.form.on(
    "Invoicing status",
    "confirm_invoice",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Sales Invoice",
                filters: {
                    name: ["=", d.invoice_no],
                },
            },
            freeze: true,
            callback: function (data) {
                data.message["doctype"] = "Sales Invoice";

                frappe.call({
                    method: "frappe.client.submit",
                    args: {
                        doc: data.message,
                    },
                    freeze: true,
                    callback: function (data) {
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: {
                                doctype: d.doctype,
                                name: d.name,
                                fieldname: "invoice_confirmed",
                                value: 1,
                            },
                            freeze: true,
                            callback: function () {
                                cur_frm.reload_doc();
                            },
                        });
                    },
                });
            },
        });
    }
);

// frappe.ui.form.on(
//   "Invoicing status",
//   "invoice_confirmed",
//   function (frm, cdt, cdn) {
//     cur_frm.save();
//   }
// );

frappe.ui.form.on(
    "Invoicing status",
    "cancel_invoice",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        //cur_frm.save();

        frappe.call({
            method: "frappe.client.cancel",
            args: {
                doctype: "Sales Invoice",
                name: d.invoice_no,
            },
            freeze: true,
            callback: function (res2) {
                //   setTimeout(function () {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "invoice_confirmed",
                    0
                );
                frappe.model.set_value(d.doctype, d.name, "invoice_created", 0);
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "invoice_cancelled",
                    1
                );
                for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                    if (
                        frm.doc.invoice_analysis[e].ref_invoice_no == d.invoice_no
                    ) {
                        frappe.model.set_value("Invoice analysis", frm.doc.invoice_analysis[e].name, "is_invoiced", 0);
                        frappe.model.set_value("Invoice analysis", frm.doc.invoice_analysis[e].name, "ref_invoice_no", "");
                        frappe.model.set_value(
                            p.doctype,
                            p.name,
                            "combined_invoice",
                            1
                        );
                    }
                }
                //   }, 3000);
                cur_frm.save();
            },
        });

        // frappe.call({
        //   method: "frappe.client.get_value",
        //   args: {
        //     doctype: "Customer",
        //     fieldname: "customer_group",
        //     filters: {
        //       name: ["=", p.invoiced_to_payer],
        //     },
        //   },
        //   freeze: true,
        //   callback: function (data) {
        //     console.log(data.message.customer_group);

        //     if (data.message.customer_group == "Individual") {
        //       frappe.msgprint("Creating a return Invoice.... Please wait");
        //       frappe.call({
        //         method: "malco_erpnext.malco_erpnext.malco_erpnext.return_invoice",
        //         args: {
        //           doctype: "Sales Invoice",
        //           name: d.invoice_no,
        //         },
        //         freeze: true,
        //         callback: function (res1) {
        //         //   setTimeout(function () {
        //             frappe.model.set_value(
        //               d.doctype,
        //               d.name,
        //               "invoice_confirmed",
        //               0
        //             );
        //             frappe.model.set_value(d.doctype, d.name, "invoice_created", 0);
        //             frappe.model.set_value(
        //               d.doctype,
        //               d.name,
        //               "invoice_cancelled",
        //               1
        //             );
        //             for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
        //               if (
        //                 frm.doc.invoice_analysis[e].ref_invoice_no == d.invoice_no
        //               ) {
        //                 frappe.model.set_value("Invoice analysis", frm.doc.invoice_analysis[e].name, "is_invoiced", 0);
        //                 frappe.model.set_value("Invoice analysis", frm.doc.invoice_analysis[e].name, "ref_invoice_no", "");
        //                 frappe.model.set_value(
        //                   p.doctype,
        //                   p.name,
        //                   "combined_invoice",
        //                   1
        //                 );
        //                 frappe.msgprint("Return Invoice Created.");
        //               }
        //             }
        //         //   }, 3000);
        //             cur_frm.save();
        //         },
        //       });
        //     } else {
        //       frappe.call({
        //         method: "frappe.client.cancel",
        //         args: {
        //           doctype: "Sales Invoice",
        //           name: d.invoice_no,
        //         },
        //         freeze: true,
        //         callback: function (res2) {
        //         //   setTimeout(function () {
        //             frappe.model.set_value(
        //               d.doctype,
        //               d.name,
        //               "invoice_confirmed",
        //               0
        //             );
        //             frappe.model.set_value(d.doctype, d.name, "invoice_created", 0);
        //             frappe.model.set_value(
        //               d.doctype,
        //               d.name,
        //               "invoice_cancelled",
        //               1
        //             );
        //             for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
        //               if (
        //                 frm.doc.invoice_analysis[e].ref_invoice_no == d.invoice_no
        //               ) {
        //                 frappe.model.set_value("Invoice analysis", frm.doc.invoice_analysis[e].name, "is_invoiced", 0);
        //                 frappe.model.set_value("Invoice analysis", frm.doc.invoice_analysis[e].name, "ref_invoice_no", "");
        //                 frappe.model.set_value(
        //                   p.doctype,
        //                   p.name,
        //                   "combined_invoice",
        //                   1
        //                 );
        //               }
        //             }
        //         //   }, 3000);
        //         cur_frm.save();
        //         },
        //       });
        //     }
        //   },
        // });
    }
);

frappe.ui.form.on(
    "Project",
    "create_payment_request",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var invoice_no = p.invoice_no || "";

        if (flt(p.total_outstanding_payment) >= 0.0) {
            t = new Array();
            if (p.payment_type == "Advance payment" && invoice_no == "") {
                t[0] = {
                    account: "Debtors - MalCo",
                    party_type: "Customer",
                    party: p.invoiced_to_payer,
                    cost_center: "Main - MalCo",
                    credit_in_account_currency: p.current_payment,
                    //"reference_type": "Sales Order",
                    //"reference_name": p.sales_order_no,
                    is_advance: "Yes",
                };
                t[1] = {
                    account: p.payment_account,
                    cost_center: "Main - MalCo",
                    debit_in_account_currency: p.current_payment,
                };
            }
            if (p.payment_type == "No advance payment" || invoice_no != "") {
                t[0] = {
                    account: "Debtors - MalCo",
                    party_type: "Customer",
                    party: p.invoiced_to_payer,
                    cost_center: "Main - MalCo",
                    credit_in_account_currency: p.current_payment,
                    //"reference_type": "Sales Order",
                    //"reference_name": p.sales_order_no,
                    is_advance: "No",
                };
                t[1] = {
                    account: p.payment_account,
                    cost_center: "Main - MalCo",
                    debit_in_account_currency: p.current_payment,
                };
            }
            var today = new Date();
            console.log(t);

            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        doctype: "Journal Entry",
                        voucher_type: p.voucher_type,
                        posting_date: p.date_of_payment,
                        company: "MalCo Customs Clearance Limited",
                        cheque_no: p.project_name,
                        cheque_date: p.date_of_payment,
                        accounts: t,
                        project_reference: p.project_name,
                        project: p.project_name,
                    },
                },
                freeze: true,
                callback: function (data) {
                    console.log(data.message.name);
                    frappe.model.set_value(
                        p.doctype,
                        p.name,
                        "is_payment_request_created",
                        1
                    );
                    frappe.model.set_value(
                        p.doctype,
                        p.name,
                        "payment_voucher_confirmed",
                        0
                    );
                    frappe.model.set_value(
                        p.doctype,
                        p.name,
                        "payment_voucher_no",
                        data.message.name
                    );
                },
            });
        }
        if (flt(p.total_outstanding_payment) == 0.0) {
            msgprint("You have already collected Invoiced amount.");
        }
        if (flt(p.total_outstanding_payment) < 0.0) {
            var diff = p.total_outstanding_payment - p.current_payment;
            frappe.model.set_value(
                p.doctype,
                p.name,
                "total_outstanding_payment",
                diff
            );
        }
    }
);

cur_frm.cscript.custom_is_payment_request_created = function (doc, cdt, cd) {
    if (doc.is_payment_request_created == 1) {
        cur_frm.save();
    }
};

frappe.ui.form.on(
    "Project",
    "confirm_payment_voucher",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        //cur_frm.save();
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Journal Entry",
                filters: {
                    name: ["=", p.payment_voucher_no],
                },
            },
            freeze: true,
            callback: function (data) {
                data.message["doctype"] = "Journal Entry";

                frappe.call({
                    method: "frappe.client.submit",
                    args: {
                        doc: data.message,
                    },
                    freeze: true,
                    callback: function (data) {
                        setTimeout(function () {
                            frappe.model.set_value(
                                p.doctype,
                                p.name,
                                "payment_voucher_confirmed",
                                1
                            );
                        }, 3000);
                    },
                });
            },
        });
    }
);

cur_frm.cscript.custom_payment_voucher_confirmed = function (doc, cdt, cd) {
    if (doc.payment_voucher_confirmed == 1) {
        cur_frm.save();
    }
    if (doc.payment_voucher_confirmed == 0) {
        cur_frm.save();
    }
};

frappe.ui.form.on(
    "Project",
    "clear_all_workflow_transactions",
    function (frm, cdt, cdn) {
        if (
            confirm(
                "Are you sure you want to clear all workflow(This action can not be undone)?"
            )
        ) {
            var p = frm.doc;
            frappe.model.set_value(p.doctype, p.name, "quotation_no", "");
            frappe.model.set_value(p.doctype, p.name, "is_quotation_created", 0);
            frappe.model.set_value(p.doctype, p.name, "sales_order_no", "");
            frappe.model.set_value(p.doctype, p.name, "is_sales_order_created", 0);
            frappe.model.set_value(p.doctype, p.name, "payment_voucher_no", "");
            frappe.model.set_value(
                p.doctype,
                p.name,
                "is_payment_request_created",
                0
            );
            frappe.model.set_value(p.doctype, p.name, "payment_voucher_confirmed", 0);
            frappe.model.set_value(p.doctype, p.name, "current_payment", "");
            frappe.model.set_value(
                p.doctype,
                p.name,
                "total_outstanding_payment",
                ""
            );
            frappe.model.set_value(p.doctype, p.name, "payment_reference", "");
            frappe.model.set_value(p.doctype, p.name, "payment_reference_date", "");
            frappe.model.set_value(p.doctype, p.name, "xml_file_created", 0);
            frappe.model.set_value(p.doctype, p.name, "xml_file_uploaded", 0);
            frappe.model.set_value(p.doctype, p.name, "delivery_note_no", "");
            frappe.model.set_value(p.doctype, p.name, "is_delivery_note_created", 0);
            frappe.model.set_value(p.doctype, p.name, "delivery_note_confirmed", 0);
            frappe.model.set_value(p.doctype, p.name, "invoice_no", "");
            frappe.model.set_value(p.doctype, p.name, "is_invoice_created", 0);
            frappe.model.set_value(p.doctype, p.name, "invoice_confirmed", 0);
            frappe.model.set_value(p.doctype, p.name, "combined_invoice", 1);
            frappe.model.set_value(p.doctype, p.name, "xml_counter", 1);
            frappe.model.set_value(p.doctype, p.name, "current_payment", "");

            var a = frm.doc.customs_warehouse;
            var fa = [];
            var ca = [];
            var cd = [];
            var cas = [];
            var ias = [];
            frm.doc.invoicing_status = [];
            frm.doc.delivery_note_status = [];

            for (var a = 0; a < frm.doc.financial_analysis.length; a++) {
                if (frm.doc.financial_analysis[a].is_automatic == 0) {
                    fa.push(frm.doc.financial_analysis[a]);
                }
            }
            for (var b = 0; b < frm.doc.customs_attachments.length; b++) {
                if (frm.doc.customs_attachments[b].is_automatic == 0) {
                    ca.push(frm.doc.customs_attachments[b]);
                }
            }

            if (
                frm.doc.commodities_data &&
                frm.doc.commodities_data.length > 0
                // frm.doc.commodities_data[0].preferential_status != " " &&
                // p.delivery_order != "0"
            ) {
                for (var c = 0; c < frm.doc.customs_duties_analysis.length; c++) {
                    if (frm.doc.customs_duties_analysis[c].is_automatic == 0) {
                        cd.push(frm.doc.customs_duties_analysis[c]);
                    }
                }
                for (var d = 0; d < frm.doc.cost_analysis.length; d++) {
                    if (frm.doc.cost_analysis[d].is_automatic == 0) {
                        cas.push(frm.doc.cost_analysis[d]);
                    }
                }
            }

            for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                if (frm.doc.invoice_analysis[e].is_automatic == 0) {
                    ias.push(frm.doc.invoice_analysis[e]);
                }
            }

            frm.doc.financial_analysis = [];
            frm.doc.customs_attachments = [];
            if (
                frm.doc.commodities_data &&
                frm.doc.commodities_data.length > 0
                // frm.doc.commodities_data[0].preferential_status != " " &&
                // p.delivery_order != "0"
            ) {
                frm.doc.customs_duties_analysis = [];
                frm.doc.cost_analysis = [];
            }
            frm.doc.invoice_analysis = [];

            refresh_field("financial_analysis");
            refresh_field("customs_attachments");
            refresh_field("customs_duties_analysis");
            refresh_field("cost_analysis");
            refresh_field("invoice_analysis");

            for (var a = 0; a < fa.length; a++) {
                var crow = frm.add_child("financial_analysis");
                crow.hs_code = fa[a].hs_code;
                crow.financial_data = fa[a].financial_data;
                crow.financial_data_value = fa[a].financial_data_value;
                crow.financial_currency = fa[a].financial_currency;
                crow.currency_rate = fa[a].currency_rate;
                crow.euro_total = fa[a].euro_total;
                refresh_field("financial_analysis");
            }

            for (var b = 0; b < ca.length; b++) {
                var orow = frm.add_child("customs_attachments");
                orow.hs_code = ca[b].hs_code;
                orow.document_code = ca[b].document_code;
                orow.customs_document_description = ca[b].customs_document_description;
                orow.document_number = ca[b].document_number;
                refresh_field("customs_attachments");
            }

            for (var c = 0; c < cd.length; c++) {
                var rrow = frm.add_child("customs_duties_analysis");
                rrow.hs_code = cd[c].hs_code;
                rrow.customs_charges_code = cd[c].customs_charges_code;
                rrow.customs_charges_description = cd[c].customs_charges_description;
                rrow.way_of_payment_duties = cd[c].way_of_payment_duties;
                rrow.tax_base = cd[c].tax_base;
                rrow.coefficient = cd[c].coefficient;
                rrow.customs_charge = cd[c].customs_charge;
                refresh_field("customs_duties_analysis");
            }

            for (var d = 0; d < cas.length; d++) {
                var rrow = frm.add_child("cost_analysis");
                rrow.billing_account = cas[d].billing_account;
                rrow.billing_account_description = cas[d].billing_account_description;
                rrow.billing_account_document = cas[d].billing_account_document;
                rrow.billing_account_notes = cas[d].billing_account_notes;
                rrow.billing_quantity = cas[d].billing_quantity;
                rrow.billing_value = cas[d].billing_value;
                rrow.vat = cas[d].vat;
                rrow.vat_value = cas[d].vat_value;
                rrow.total_billing_value = cas[d].total_billing_value;
                refresh_field("cost_analysis");
            }

            for (var e = 0; e < ias.length; e++) {
                var rrow = frm.add_child("invoice_analysis");
                rrow.billing_account = ias[e].billing_account;
                rrow.billing_account_description = ias[e].billing_account_description;
                rrow.billing_account_document = ias[e].billing_account_document;
                rrow.billing_account_notes = ias[e].billing_account_notes;
                rrow.billing_quantity = ias[e].billing_quantity;
                rrow.billing_value = ias[e].billing_value;
                rrow.vat = ias[e].vat;
                rrow.vat_value = ias[e].vat_value;
                rrow.total_billing_value = ias[e].total_billing_value;
                refresh_field("invoice_analysis");
            }

            refresh_field("financial_analysis");
            refresh_field("customs_attachments");
            refresh_field("customs_duties_analysis");
            refresh_field("cost_analysis");
            refresh_field("invoice_analysis");

            frappe.model.set_value(p.doctype, p.name, "quotation_confirmed", 0);
            frappe.model.set_value(p.doctype, p.name, "quotation_accepted", 0);
            frappe.model.set_value(p.doctype, p.name, "sales_order_confirmed", 0);
            frappe.model.set_value(p.doctype, p.name, "icisnet_status", "");
            frappe.model.set_value(p.doctype, p.name, "rejection_reason", "");
        } else {
        }
    }
);

frappe.ui.form.on("Project", "quotation_is_accepted", function (frm, cdt, cdn) {
    var p = frm.doc;
    if (p.quotation_confirmed == 0) {
        msgprint("Please create and confirm quotation first.");
    }
    if (p.quotation_confirmed == 1) {
        frappe.model.set_value(p.doctype, p.name, "quotation_accepted", 1);
    }
});

frappe.ui.form.on(
    "Project",
    "cancel_quotation_acceptance",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.model.set_value(p.doctype, p.name, "quotation_accepted", 0);
        frappe.call({
            method: "frappe.client.set_value",
            args: {
                doctype: "Quotation",
                name: p.quotation_no,
                fieldname: "status",
                value: "Lost",
            },
            freeze: true,
            callback: function () {
                frappe.msgprint("Updated");
            },
        });
    }
);

cur_frm.cscript.custom_quotation_accepted = function (doc, cdt, cd) {
    if (doc.quotation_accepted == 1) {
        cur_frm.save();
    }
    if (doc.quotation_accepted == 0) {
        cur_frm.save();
    }
};

frappe.ui.form.on("Project", "send_payment_request", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";

    if (p.quotation_confirmed == 1 || p.skip_primary_workflow == 1) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Address",
                fieldname: "email_id",
                filters: {
                    name: ["=", getname],
                },
            },
            freeze: true,
            callback: function (data) {
                if (data.message) {
                    var composer = new frappe.views.CommunicationComposer({
                        doc: cur_frm.doc,
                        frm: cur_frm,
                        subject: "Project: " + p.name,
                        recipients: data.message.email_id,
                        attach_document_print: false,
                    });

                    composer.dialog.set_value("standard_reply", "Payment Request EN");
                    composer.dialog.set_value("send_me_a_copy", true);
                } else {
                    frappe.throw(
                        "Email Address is not found, please put email address in the Address."
                    );
                }
            },
        });
    }
    if (p.quotation_confirmed == 0 && p.skip_primary_workflow == 0) {
        msgprint("Please create and confirm Sales Order first.");
    }
});

frappe.ui.form.on(
    "Project",
    "send_payment_request_in_greek",
    function (frm, cdt, cdn) {
        var me = this;
        var p = frm.doc;
        var d = locals[cdt][cdn];
        var getname = p.invoiced_to_payer + "-Billing";
        var message = "";

        if (p.quotation_confirmed == 1 || p.skip_primary_workflow == 1) {
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Address",
                    fieldname: "email_id",
                    filters: {
                        name: ["=", getname],
                    },
                },
                freeze: true,
                callback: function (data) {
                    if (data.message) {
                        var composer = new frappe.views.CommunicationComposer({
                            doc: cur_frm.doc,
                            frm: cur_frm,
                            subject: "Project: " + p.name,
                            recipients: data.message.email_id,
                            attach_document_print: false,
                        });

                        composer.dialog.set_value("standard_reply", "Payment Request GR");
                        composer.dialog.set_value("send_me_a_copy", true);
                    } else {
                        frappe.throw(
                            "Email Address is not found, please put email address in the Address."
                        );
                    }
                },
            });
        }
        if (p.quotation_confirmed == 0 && p.skip_primary_workflow == 0) {
            msgprint("Please create and confirm Sales Order first.");
        }
    }
);

frappe.ui.form.on("Project", "confirm_invoice", function (frm, cdt, cdn) {
    var p = frm.doc;

    var vatind = 0;
    var vatfinal = 0;
    var vatimport = 0;
    var exvat = 0;
    for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
        //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined"){
        //	vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
        //}
        //if (frm.doc.invoice_analysis[e].is_invoiced == 0 && frm.doc.invoice_analysis[e].billing_account_document != "undefined" && frm.doc.invoice_analysis[e].billing_account == "ΦΠΑ εισαγωγής - Import VAT"){
        //	vatimport = frm.doc.invoice_analysis[e].total_billing_value;
        //}
        if (
            frm.doc.invoice_analysis[e].is_invoiced == 0 &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ εισαγωγής - Import VAT" &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT" &&
            frm.doc.invoice_analysis[e].billing_account_document != "undefined"
        ) {
            vatind = vatind + flt(frm.doc.invoice_analysis[e].vat_value);
        }
        if (
            frm.doc.invoice_analysis[e].is_invoiced == 0 &&
            (frm.doc.invoice_analysis[e].billing_account ==
                "ΦΠΑ εισαγωγής - Import VAT" ||
                frm.doc.invoice_analysis[e].billing_account ==
                "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT") &&
            frm.doc.invoice_analysis[e].billing_account_document != "undefined"
        ) {
            vatimport = vatimport + frm.doc.invoice_analysis[e].total_billing_value;
        }
        if (
            frm.doc.invoice_analysis[e].is_invoiced == 0 &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ εισαγωγής - Import VAT" &&
            frm.doc.invoice_analysis[e].billing_account !=
            "ΦΠΑ Πετρ.Εγχ και ΕΕ - Fuel VAT" &&
            frm.doc.invoice_analysis[e].billing_account_document != "undefined"
        ) {
            tempcal =
                flt(frm.doc.invoice_analysis[e].billing_value) *
                flt(frm.doc.invoice_analysis[e].billing_quantity);
            exvat = exvat + tempcal;
        }
    }
    vatfinal = vatind + vatimport + exvat;
    console.log(vatind);
    console.log(vatimport);
    console.log(exvat);
    console.log(vatfinal);

    const w = window.open(
        "/api/method/malco_erpnext.malco_erpnext.malco_erpnext.download_multi_pdf?" +
        "doctype=" +
        encodeURIComponent("Sales Invoice") +
        "&name=" +
        encodeURIComponent("SINV-00093")
    );
    if (!w) {
        frappe.msgprint(__("Please enable pop-ups"));
        return;
    }
});

frappe.ui.form.on("Cost analysis", "billing_account", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            filters: {
                name: ["=", d.billing_account],
            },
        },
        freeze: true,
        callback: function (data) {
            frappe.model.set_value(
                d.doctype,
                d.name,
                "vat",
                data.message.taxes[0].tax_rate
            );
        },
    });
});

frappe.ui.form.on(
    "Invoice analysis",
    "billing_account",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Item",
                filters: {
                    name: ["=", d.billing_account],
                },
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "vat",
                    data.message.taxes[0].tax_rate
                );
            },
        });
    }
);

frappe.ui.form.on("Project", "customs_document_type", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    cur_frm.set_df_property("malco_workflow", "hidden", 0);
    cur_frm.set_df_property("payment_actions", "hidden", 0);
    cur_frm.set_df_property("delivery_and_invoice_actions", "hidden", 0);
    cur_frm.set_df_property("invoicing_details", "hidden", 0);
    cur_frm.set_df_property("workflow_tools", "hidden", 0);
    cur_frm.set_df_property("project_data", "hidden", 0);
    cur_frm.set_df_property("brake_6", "hidden", 0);
    cur_frm.set_df_property("customer_details", "hidden", 0);
    cur_frm.set_df_property("invoice_party", "hidden", 0);
    cur_frm.set_df_property("basic_customs_clearance_data", "hidden", 0);
    cur_frm.set_df_property("transport_data", "hidden", 0);
    cur_frm.set_df_property("shipping_data", "hidden", 0);
    cur_frm.set_df_property("break_1", "hidden", 0);
    cur_frm.set_df_property("finance_data", "hidden", 0);
    cur_frm.set_df_property("customs_authorities_data", "hidden", 0);
    cur_frm.set_df_property("commodities", "hidden", 0);
    cur_frm.set_df_property("fetch_n_clear_values_actions", "hidden", 0);
    cur_frm.set_df_property("alcohol_data", "hidden", 0);
    cur_frm.set_df_property("print_forms_total", "hidden", 0);
    cur_frm.set_df_property("customs_attachments_data", "hidden", 0);
    cur_frm.set_df_property("special_refernces_data", "hidden", 0);
    cur_frm.set_df_property("financial_analysis_data", "hidden", 0);
    cur_frm.set_df_property("customs_duties_data", "hidden", 0);
    cur_frm.set_df_property("cost_analysis_data", "hidden", 0);
    cur_frm.set_df_property("invoice_analysis_data", "hidden", 0);
    cur_frm.set_df_property("banking_and_statistics", "hidden", 0);
    cur_frm.set_df_property("break_2", "hidden", 0);
    cur_frm.set_df_property("sb_milestones", "hidden", 0);
    cur_frm.set_df_property("section_break_18", "hidden", 0);
    cur_frm.set_df_property("project_details", "hidden", 0);
    cur_frm.set_df_property("margin", "hidden", 0);
    cur_frm.set_df_property("section_break0", "hidden", 0);
    cur_frm.set_df_property("xml_data", "hidden", 0);
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Customs Document Type",
            filters: {
                name: ["=", p.customs_document_type],
            },
        },
        freeze: true,
        callback: function (data) {
            for (var d = 0; d < data.message.hidden_fields_list.length; d++) {
                console.log(data.message.hidden_fields_list[d].field_name);
                if (data.message.hidden_fields_list[d].field_name.indexOf("-") >= 0) {
                    var res = data.message.hidden_fields_list[d].field_name.split(
                        "-----"
                    );
                    var res1 = res[1].replace(/_/g, " ");

                    var res2 = res1.charAt(0).toUpperCase() + res1.slice(1);

                    var df = frappe.meta.get_docfield(res2, res[0], cur_frm.doc.name);
                    df.hidden = 1;
                } else {
                    cur_frm.set_df_property(
                        data.message.hidden_fields_list[d].field_name,
                        "hidden",
                        1
                    );
                }
            }
        },
    });
});

frappe.ui.form.on("Project", "refresh", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    // if(p.name === "2019.CS.0294"){
    //     frappe.db.set_value(p.doctype, p.name, "project_name", p.name);
    // }

    if (localStorage.getItem("upload_xml_to_komvos") == cur_frm.doc.name) {
        localStorage.removeItem("upload_xml_to_komvos");
        frm.trigger("upload_xml_via_komvos");
    }

    if (p.company == "MalCo - N. Malefakis & Co.") {
        frappe.db.set_value(p.doctype, p.name, "company", "MalCo Customs Clearance Limited");
    }

    docr = new Date(p.date_of_customs_declaration);
    cutoff = new Date("2018-04-30");
    if (docr > cutoff) {
        console.log("Its later date");
    } else {
        console.log("Its earlier date");
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Supplier",
            filters: {
                name: ["=", p.customs_agent_master],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data);
        },
    });

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Supplier",
            fieldname: "supplier_type",
            filters: {
                name: ["=", p.customs_agent_master],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data);
        },
    });

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Customs Authorities",
            fieldname: "customs_authorities_old_code",
            filters: {
                name: ["=", p.customs_authorities_of_declaration],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data);
        },
    });

    if (p.missing_xml_data) {
    } else {
        var crow = cur_frm.add_child("missing_xml_data");
        crow.lrn_code = "4005";
        refresh_field("missing_xml_data");
    }
    if (frm.doc.__islocal) {
        cur_frm.set_df_property("malco_workflow", "hidden", 1);
        cur_frm.set_df_property("payment_actions", "hidden", 1);
        cur_frm.set_df_property("delivery_and_invoice_actions", "hidden", 1);
        cur_frm.set_df_property("invoicing_details", "hidden", 1);
        cur_frm.set_df_property("workflow_tools", "hidden", 1);
        cur_frm.set_df_property("project_data", "hidden", 1);
        cur_frm.set_df_property("brake_6", "hidden", 1);
        cur_frm.set_df_property("customer_details", "hidden", 1);
        cur_frm.set_df_property("invoice_party", "hidden", 1);
        cur_frm.set_df_property("basic_customs_clearance_data", "hidden", 1);
        cur_frm.set_df_property("transport_data", "hidden", 1);
        cur_frm.set_df_property("shipping_data", "hidden", 1);
        cur_frm.set_df_property("break_1", "hidden", 1);
        cur_frm.set_df_property("finance_data", "hidden", 1);
        cur_frm.set_df_property("customs_authorities_data", "hidden", 1);
        cur_frm.set_df_property("commodities", "hidden", 1);
        cur_frm.set_df_property("fetch_n_clear_values_actions", "hidden", 1);
        cur_frm.set_df_property("alcohol_data", "hidden", 1);
        cur_frm.set_df_property("print_forms_total", "hidden", 1);
        cur_frm.set_df_property("customs_attachments_data", "hidden", 1);
        cur_frm.set_df_property("special_refernces_data", "hidden", 1);
        cur_frm.set_df_property("financial_analysis_data", "hidden", 1);
        cur_frm.set_df_property("customs_duties_data", "hidden", 1);
        cur_frm.set_df_property("cost_analysis_data", "hidden", 1);
        cur_frm.set_df_property("invoice_analysis_data", "hidden", 1);
        cur_frm.set_df_property("banking_and_statistics", "hidden", 1);
        cur_frm.set_df_property("break_2", "hidden", 1);
        cur_frm.set_df_property("sb_milestones", "hidden", 1);
        cur_frm.set_df_property("section_break_18", "hidden", 1);
        cur_frm.set_df_property("project_details", "hidden", 1);
        cur_frm.set_df_property("margin", "hidden", 1);
        cur_frm.set_df_property("section_break0", "hidden", 1);
        cur_frm.set_df_property("consulting", "hidden", 1);
        cur_frm.set_df_property("consulting_details", "hidden", 1);
        // cur_frm.set_df_property("countries_data", "hidden", 1);
    } else {
        console.log("I am here");
        cur_frm.set_df_property("malco_workflow", "hidden", 0);
        cur_frm.set_df_property("payment_actions", "hidden", 0);
        cur_frm.set_df_property("delivery_and_invoice_actions", "hidden", 0);
        cur_frm.set_df_property("invoicing_details", "hidden", 0);
        cur_frm.set_df_property("workflow_tools", "hidden", 0);
        cur_frm.set_df_property("project_data", "hidden", 0);
        cur_frm.set_df_property("brake_6", "hidden", 0);
        cur_frm.set_df_property("customer_details", "hidden", 0);
        cur_frm.set_df_property("invoice_party", "hidden", 0);
        cur_frm.set_df_property("basic_customs_clearance_data", "hidden", 0);
        cur_frm.set_df_property("transport_data", "hidden", 0);
        cur_frm.set_df_property("shipping_data", "hidden", 0);
        cur_frm.set_df_property("break_1", "hidden", 0);
        cur_frm.set_df_property("finance_data", "hidden", 0);
        cur_frm.set_df_property("customs_authorities_data", "hidden", 0);
        cur_frm.set_df_property("commodities", "hidden", 0);
        cur_frm.set_df_property("fetch_n_clear_values_actions", "hidden", 0);
        cur_frm.set_df_property("alcohol_data", "hidden", 0);
        cur_frm.set_df_property("print_forms_total", "hidden", 0);
        cur_frm.set_df_property("customs_attachments_data", "hidden", 0);
        cur_frm.set_df_property("special_refernces_data", "hidden", 0);
        cur_frm.set_df_property("financial_analysis_data", "hidden", 0);
        cur_frm.set_df_property("customs_duties_data", "hidden", 0);
        cur_frm.set_df_property("cost_analysis_data", "hidden", 0);
        cur_frm.set_df_property("invoice_analysis_data", "hidden", 0);
        cur_frm.set_df_property("banking_and_statistics", "hidden", 0);
        cur_frm.set_df_property("break_2", "hidden", 0);
        cur_frm.set_df_property("sb_milestones", "hidden", 0);
        cur_frm.set_df_property("section_break_18", "hidden", 0);
        cur_frm.set_df_property("project_details", "hidden", 0);
        cur_frm.set_df_property("margin", "hidden", 0);
        cur_frm.set_df_property("section_break0", "hidden", 0);
        cur_frm.set_df_property("xml_data", "hidden", 0);
        cur_frm.set_df_property("countries_data", "hidden", 0);

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Customs Document Type",
                filters: {
                    name: ["=", p.customs_document_type],
                },
            },
            freeze: true,
            callback: function (data) {
                for (var d = 0; d < data.message.hidden_fields_list.length; d++) {
                    console.log(data.message.hidden_fields_list[d].field_name);
                    if (data.message.hidden_fields_list[d].field_name.indexOf("-") >= 0) {
                        var res = data.message.hidden_fields_list[d].field_name.split(
                            "-----"
                        );
                        var res1 = res[1].replace(/_/g, " ");

                        var res2 = res1.charAt(0).toUpperCase() + res1.slice(1);

                        var df = frappe.meta.get_docfield(res2, res[0], cur_frm.doc.name);
                        df.hidden = 1;
                    } else {
                        cur_frm.set_df_property(
                            data.message.hidden_fields_list[d].field_name,
                            "hidden",
                            1
                        );
                    }
                }

                if (frappe.user.has_role("Customs Agent Contractor (CAC)")) {
                    // for(var key in cur_frm.fields_dict) {
                    //     cur_frm.set_df_property(key, "read_only", 1);
                    //     if(cur_frm.fields_dict[key].grid) {
                    //         //console.log(cur_frm.fields_dict[key].grid.docfields[0]);
                    //         for(var key1 in cur_frm.fields_dict[key].grid.docfields) {
                    //             console.log(key1);
                    //             cur_frm.set_df_property(key1, "read_only", 1);
                    //         }
                    //     }
                    // }
                    console.log("Calling CAC");
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Project Fields List",
                            fields: ["field_name"],
                            filters: {
                                parent: ["=", "CAC Controls"],
                            },
                        },
                        freeze: true,
                        callback: function (data) {
                            console.log(data);
                            for (var d = 0; d < data.message.length; d++) {
                                console.log(data.message[d].field_name);
                                if (data.message[d].field_name.indexOf("-") >= 0) {
                                    var res = data.message[d].field_name.split("-----");
                                    var res1 = res[1].replace(/_/g, " ");

                                    var res2 = res1.charAt(0).toUpperCase() + res1.slice(1);

                                    var df = frappe.meta.get_docfield(
                                        res2,
                                        res[0],
                                        cur_frm.doc.name
                                    );
                                    df.hidden = 1;
                                } else {
                                    cur_frm.set_df_property(
                                        data.message[d].field_name,
                                        "hidden",
                                        1
                                    );
                                }
                            }
                        },
                    });
                }
            },
        });
    }

    cur_frm.set_query("payment_account", function () {
        return {
            filters: {
                account_type: "Bank",
            },
        };
    });

    cur_frm.set_query("warehouse", "commodities_data", function () {
        return {
            filters: {
                type_of_warehouse: "Fuel",
            },
        };
    });

    cur_frm.set_query("to_warehouse", "commodities_data", function () {
        return {
            filters: {
                type_of_warehouse: "Fuel",
            },
        };
    });

    cur_frm.set_query("stock_entry", "commodities_data", function () {
        return {
            filters: {
                purpose: "Material Receipt",
                docstatus: 1,
            },
        };
    });

    //   if (p.project_name == "Dont Delete") {
    //     console.log("Its Dont delete");
    //     for (var key in cur_frm.fields_dict) {
    //       if (cur_frm.fields_dict[key].grid) {
    //         //console.log(cur_frm.fields_dict[key].grid.docfields[0]);
    //         for (var key1 in cur_frm.fields_dict[key].grid.docfields) {
    //           console.log(key1);
    //         }
    //       }
    //     }

    //     p.fields_list = [];
    //     refresh_field("fields_list");
    //     for (var key in cur_frm.fields_dict) {
    //       //console.log(cur_frm.fields_dict);
    //       var crow = cur_frm.add_child("fields_list");
    //       crow.field_name = key;
    //       refresh_field("fields_list");
    //     }
    //   }

    var xml_tb = p.missing_xml_data || [];

    if (xml_tb.length > 0) {
        console.log("XML data exists");
    } else {
        var crow = cur_frm.add_child("missing_xml_data");
        crow.lrn_code = "NA";
        refresh_field("missing_xml_data");
    }

    // var items_check = p.items || [];

    // if (items_check) {
    //     if (p.packaging_description) {
    //     } else {
    //         frappe.call({
    //             method: "frappe.client.get_value",
    //             args: {
    //                 doctype: "Packaging",
    //                 fieldname: "packaging_description_gr",
    //                 filters: {
    //                     name: ["=", p.commodities_data[0].packaging],
    //                 },
    //             },
    //             freeze: true,
    //             callback: function (data) {
    //                 frappe.model.set_value(
    //                     p.doctype,
    //                     p.name,
    //                     "packaging_description",
    //                     data.message.packaging_description_gr
    //                 );
    //             },
    //         });
    //     }
    // }
});

frappe.ui.form.on("Project", "fetch_data_for_xml", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    /////////Missing xml data script////////
    var xml_date = frappe.datetime.nowdate().substring(2);
    xml_date = xml_date.replace(/-/g, "");

    cur_frm.get_field(
        "missing_xml_data"
    ).grid.grid_rows[0].doc.date_of_creation_xml = xml_date;
    refresh_field("missing_xml_data");

    var currentdate = new Date();
    /*
              var xml_time = p.missing_xml_data[0].time_of_creation_xml.slice(0,-3);		
              xml_time = xml_time.replace(/:/g,'');
              */
    var minutesnow = currentdate.getMinutes();
    var hoursnow = currentdate.getHours();

    console.log("See here");
    console.log(hoursnow.toString().length);
    console.log(minutesnow.toString().length);

    if (hoursnow.toString().length < 2) {
        hoursnow = "0" + hoursnow;
    }
    if (minutesnow.toString().length < 2) {
        minutesnow = "0" + minutesnow;
    }
    var xml_time = hoursnow + "" + minutesnow;

    cur_frm.get_field(
        "missing_xml_data"
    ).grid.grid_rows[0].doc.time_of_creation_xml = xml_time;
    refresh_field("missing_xml_data");
    //cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.time_of_creation_xml = frappe.datetime.now();
    //refresh_field("missing_xml_data")

    if (p.customs_agent_master) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Supplier",
                fieldname: "tax_id",
                filters: {
                    name: ["=", p.customs_agent_master],
                },
            },
            freeze: true,
            callback: function (data) {
                var currentdate = new Date();
                year = currentdate.getFullYear().toString().substring(2, 4);
                pname = p.name.replace(/\./g, "");
                var plength = pname.length;
                p3name = pname.substring(plength - 3, plength + 1);
                p4name = pname.substring(plength - 4, plength + 1);
                cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.lrn_code =
                    data.message.tax_id + year + p3name;
                refresh_field("missing_xml_data");
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.lrn_code_forward_slash =
                    data.message.tax_id + "/" + year + "/" + p4name + "/" + "0";
                refresh_field("missing_xml_data");
                if (p.xml_counter <= 10) {
                    var lrn_s = p.missing_xml_data[0].lrn_code_forward_slash.slice(0, -1);
                    lrn_s = lrn_s + p.xml_counter;
                } else {
                    var lrn_s = p.missing_xml_data[0].lrn_code_forward_slash.slice(0, -2);
                    lrn_s = lrn_s + p.xml_counter;
                }
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.lrn_code_forward_slash = lrn_s;
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Customs agent master is missing");
    }

    if (p.country_of_final_destination) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Country",
                fieldname: "code",
                filters: {
                    name: ["=", p.country_of_final_destination],
                },
            },
            freeze: true,
            callback: function (data) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.country_of_final_destination_code = data.message.code.toUpperCase();
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Country of final destination is missing");
    }

    if (p.country_of_import_or_export) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Country",
                fieldname: "code",
                filters: {
                    name: ["=", p.country_of_import_or_export],
                },
            },
            freeze: true,
            callback: function (data) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.country_of_import_or_export_code = data.message.code.toUpperCase();
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Country of import or export is missing");
    }

    if (p.external_means_of_transport) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Means of Transport",
                fieldname: "means_of_transport_nationality",
                filters: {
                    name: ["=", p.external_means_of_transport],
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data);
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Country",
                        fieldname: "code",
                        filters: {
                            name: ["=", data.message.means_of_transport_nationality],
                        },
                    },
                    freeze: true,
                    callback: function (res) {
                        console.log(res.message.code.toUpperCase());
                        cur_frm.get_field(
                            "missing_xml_data"
                        ).grid.grid_rows[0].doc.external_means_of_transport_nationality_code = res.message.code.toUpperCase();
                        refresh_field("missing_xml_data");
                    },
                });
            },
        });
    } else {
        frappe.msgprint("External Means of Transport is missing");
    }

    if (p.internal_means_of_transport_21) {
        cur_frm.get_field(
            "missing_xml_data"
        ).grid.grid_rows[0].doc.internal_means_of_transport_language_code = "EN";
        refresh_field("missing_xml_data");
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Means of Transport",
                fieldname: "means_of_transport_nationality",
                filters: {
                    name: ["=", p.internal_means_of_transport_21],
                },
            },
            freeze: true,
            callback: function (data) {
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Country",
                        fieldname: "code",
                        filters: {
                            name: ["=", data.message.means_of_transport_nationality],
                        },
                    },
                    freeze: true,
                    callback: function (res) {
                        cur_frm.get_field(
                            "missing_xml_data"
                        ).grid.grid_rows[0].doc.internal_means_of_transport_nationality_code = res.message.code.toUpperCase();
                        refresh_field("missing_xml_data");
                    },
                });
            },
        });
    } else {
        frappe.msgprint("Internal Means of Transport is missing");
    }

    if (p.commercial_invoice_number && p.commercial_invoice_date) {
        cur_frm.get_field(
            "missing_xml_data"
        ).grid.grid_rows[0].doc.commercial_invoice_number_and_date =
            p.commercial_invoice_number + "/" + p.commercial_invoice_date;
        refresh_field("missing_xml_data");
    } else {
        frappe.msgprint("Commercial Invoice Number/Date are missing");
    }

    if (p.house_master) {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Address",
                filters: {
                    name: ["=", p.house_master + "-Billing"],
                },
            },
            freeze: true,
            callback: function (data) {
                if (data.message.address_line1) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.hm_address = data.message.address_line1;
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.hm_address = "-";
                }
                if (data.message.pincode) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.hm_post_code = data.message.pincode;
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.hm_post_code = "-";
                }
                if (data.message.city) {
                    cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.hm_city =
                        data.message.city;
                } else {
                    cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.hm_city =
                        "-";
                }
                refresh_field("missing_xml_data");

                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Country",
                        fieldname: "code",
                        filters: {
                            name: ["=", data.message.country],
                        },
                    },
                    freeze: true,
                    callback: function (res) {
                        cur_frm.get_field(
                            "missing_xml_data"
                        ).grid.grid_rows[0].doc.hm_country_code = res.message.code.toUpperCase();
                        refresh_field("missing_xml_data");
                    },
                });
            },
        });

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customer",
                fieldname: "eori_number",
                filters: {
                    name: ["=", p.house_master],
                },
            },
            freeze: true,
            callback: function (res) {
                cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.hm_eori =
                    data.message.eori_number;
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("House Master is missing");
    }

    if (p.customer) {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Address",
                filters: {
                    name: ["=", p.customer + "-Billing"],
                },
            },
            freeze: true,
            callback: function (data) {
                if (data.message.pincode) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customer_post_code = data.message.pincode;
                    refresh_field("missing_xml_data");
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customer_post_code = "-";
                    refresh_field("missing_xml_data");
                }
                if (data.message.city) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customer_city = data.message.city;
                    refresh_field("missing_xml_data");
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customer_city = "-";
                    refresh_field("missing_xml_data");
                }

                if (data.message.address_line1) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customer_address = data.message.address_line1;
                    refresh_field("missing_xml_data");
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customer_address = "-";
                    refresh_field("missing_xml_data");
                }

                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Country",
                        fieldname: "code",
                        filters: {
                            name: ["=", data.message.country],
                        },
                    },
                    freeze: true,
                    callback: function (res) {
                        cur_frm.get_field(
                            "missing_xml_data"
                        ).grid.grid_rows[0].doc.customer_country_code = res.message.code.toUpperCase();
                        refresh_field("missing_xml_data");
                    },
                });
            },
        });

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customer",
                fieldname: "eori_number",
                filters: {
                    name: ["=", p.customer],
                },
            },
            freeze: true,
            callback: function (data) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.customer_eori = data.message.eori_number;
                refresh_field("missing_xml_data");
            },
        });

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customer",
                fieldname: "representation_type",
                filters: {
                    name: ["=", p.customer],
                },
            },
            freeze: true,
            callback: function (data) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.customer_representation_type =
                    data.message.representation_type;
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Customer is missing");
    }

    if (p.customs_agent_master) {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Address",
                filters: {
                    name: ["=", p.customs_agent_master + "-Billing"],
                },
            },
            freeze: true,
            callback: function (data) {
                if (data.message.address_line1) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customs_agent_master_address =
                        data.message.address_line1;
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customs_agent_master_address = "-";
                }
                if (data.message.pincode) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customs_agent_master_post_code =
                        data.message.pincode;
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customs_agent_master_post_code = "-";
                }
                if (data.message.city) {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customs_agent_master_city = data.message.city;
                } else {
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.customs_agent_master_city = "-";
                }
                refresh_field("missing_xml_data");

                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Country",
                        fieldname: "code",
                        filters: {
                            name: ["=", data.message.country],
                        },
                    },
                    freeze: true,
                    callback: function (res) {
                        cur_frm.get_field(
                            "missing_xml_data"
                        ).grid.grid_rows[0].doc.customs_agent_master_country_code = res.message.code.toUpperCase();
                        refresh_field("missing_xml_data");
                    },
                });
            },
        });

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Supplier",
                fieldname: "eori_number",
                filters: {
                    name: ["=", p.customs_agent_master],
                },
            },
            freeze: true,
            callback: function (res) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.customs_agent_master_eori_number =
                    res.message.eori_number;
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Customs agent master is missing");
    }

    cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.total_items =
        p.commodities_data.length;
    refresh_field("missing_xml_data");

    for (var e = 0; e < p.commodities_data.length; e++) {
        var hs_code = p.commodities_data[e].hs_code;
        if (hs_code.length < 22) {
            var slength = 22 - hs_code.length;
            for (var y = 0; y < slength; y++) {
                hs_code = hs_code + "0";
            }
        } else if (hs_code.length > 22) {
            hs_code = hs_code.substring(0, 22);
        }
        console.log(hs_code);
        var d8 = hs_code.substring(0, 8);
        var d2 = hs_code.substring(8, 10);
        var d4 = hs_code.substring(10, 14);
        var d4_2 = hs_code.substring(14, 18);
        var d4_3 = hs_code.substring(18, 22);
        var containers = "";
        if (p.container_data) {
            for (var f = 0; f < p.container_data.length; f++) {
                containers = containers + p.container_data[f].container_number;
                if (f != p.container_data.length - 1) {
                    containers = containers + ",";
                }
            }
        }
        var phrase = "NA";
        console.log("UOM");
        console.log(p.commodities_data[e].uom);
        pkgdescr =
            p.commodities_data[e].packaging_description_en +
            "-" +
            p.commodities_data[e].packaging_description_gr;
        //if(typeof(p.commodities_data[e].uom) == "undefined" || (p.commodities_data[e].uom !="Kg" && p.commodities_data[e].uom !="Lts" && p.container_19 == 1)){
        //if((typeof(p.commodities_data[e].uom) == "undefined" || p.commodities_data[e].uom == "" || typeof(p.commodities_data[e].uom) == "null") && p.container == 1){
        if (
            p.commodities_data[e].uom != "Kg" &&
            p.commodities_data[e].uom != "Lts" &&
            p.container == 1
        ) {
            phrase =
                "Cnrs: " +
                containers +
                " " +
                pkgdescr +
                " " +
                p.commodities_data[e].items +
                " " +
                p.commodities_data[e].hs_code_description;
        } else if (
            p.commodities_data[e].uom == "Kg" ||
            p.commodities_data[e].uom == "Lts"
        ) {
            phrase =
                "VR - XYMA " +
                p.commodities_data[e].hs_code_commercial_name_gr +
                " - " +
                p.commodities_data[e].efk_code +
                " - " +
                p.commodities_data[e].uom +
                " " +
                p.commodities_data[e].loaded_qty;
        } //else if(typeof(p.commodities_data[e].uom) == "undefined" || (p.commodities_data[e].uom !="Kg" && p.commodities_data[e].uom !="Lts" && p.container_19 == 0)){
        //else if((typeof(p.commodities_data[e].uom) == "undefined" || p.commodities_data[e].uom == "" || typeof(p.commodities_data[e].uom) == "null") && p.container == 0){
        else if (
            p.commodities_data[e].uom != "Kg" &&
            p.commodities_data[e].uom != "Lts" &&
            p.container == 0
        ) {
            phrase =
                pkgdescr +
                " " +
                p.commodities_data[e].items +
                " " +
                p.commodities_data[e].hs_code_description;
        }

        var fuel_volume = 0;
        if (
            typeof p.commodities_data[e].uom != "undefined" ||
            p.commodities_data[e].uom == "Kg" ||
            p.commodities_data[e].uom == "Lts"
        ) {
            fuel_volume = flt(p.commodities_data[e].loaded_qty) / 1000;
        }
        console.log(phrase);
        //console.log(fuel_volume);
        cur_frm.get_field("commodities_data").grid.grid_rows[
            e
        ].doc.fuel_volume = fuel_volume.toFixed(3);
        cur_frm.get_field("commodities_data").grid.grid_rows[e].doc.item_no = e + 1;
        cur_frm.get_field("commodities_data").grid.grid_rows[
            e
        ].doc.hs_code_phrase = phrase.replace(/<(?:.|\n)*?>/gm, "");
        cur_frm.get_field("commodities_data").grid.grid_rows[
            e
        ].doc.phrase_language = "EL";
        cur_frm.get_field("commodities_data").grid.grid_rows[e].doc.hs_8 = d8;
        cur_frm.get_field("commodities_data").grid.grid_rows[e].doc.hs_2 = d2;
        cur_frm.get_field("commodities_data").grid.grid_rows[e].doc.hs_4 = d4;
        cur_frm.get_field("commodities_data").grid.grid_rows[e].doc.hs_4_2 = d4_2;
        cur_frm.get_field("commodities_data").grid.grid_rows[e].doc.hs_4_3 = d4_3;
        if (p.delivery_order_net_price > 0) {
            cur_frm.get_field("commodities_data").grid.grid_rows[
                e
            ].doc.delivery_doc_code = "800";
        }
        refresh_field("commodities_data");
    }

    // if(p.country_of_origin) {
    //     frappe.call({
    //         "method": "frappe.client.get_value",
    //         args: {
    //             doctype: "Country",
    //             fieldname: "code",
    //             filters: {
    //                 name: ["=", p.country_of_origin]
    //             }
    //         },
    //         freeze: true,
    //         callback: function(res) {
    //             console.log(res.message.code);
    //             for(var f = 0; f < p.commodities_data.length; f++) {
    //                 cur_frm.get_field("commodities_data").grid.grid_rows[f].doc.country_of_origin_code = res.message.code.toUpperCase();
    //                 refresh_field("commodities_data")
    //             }
    //         }
    //     })
    // } else {
    //     frappe.msgprint("Country of origin is missing");
    // }

    if (p.place_of_customs_declaration) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Customs Warehouse",
                fieldname: "customs_warehouse_code",
                filters: {
                    name: ["=", p.place_of_customs_declaration],
                },
            },
            freeze: true,
            callback: function (res) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.grcustomcode =
                    res.message.customs_warehouse_code;
            },
        });
    } else {
        frappe.msgprint("Place of customs declaration is missing");
    }

    if (p.customs_authorities_of_declaration) {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Customs Authorities",
                filters: {
                    name: ["=", p.customs_authorities_of_declaration],
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data);
                //var cadcode = data.message.country_code + data.message.customs_authorities_old_code + "0001";

                //cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.grcustomcode = cadcode;
                //Last two digits of the current year)+(GRDH)+(ONLY last 4 digits of "Customs Authorities old code" of the customs authorities of declaration)+(manifest number)
                var today = new Date();
                var dd = today.getDate();
                var mm = today.getMonth() + 1; //January is 0!
                var yyyy = today.getFullYear();

                var year_code = yyyy.toString().substr(-2);
                var last_4_digits = data.message.customs_authorities_old_code.substr(
                    -4
                );
                var for_field_40_3 =
                    year_code + "GRDH" + last_4_digits + p.manifest_number;
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.for_field_40_3 = for_field_40_3;
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Customs authorities of declaration is missing");
    }

    if (p.house_master_fuel) {
        if (p.house_master_fuel) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Means of Transport",
                    filters: {
                        name: ["=", p.house_master_fuel],
                    },
                },
                freeze: true,
                callback: function (data) {
                    var address =
                        "KO " +
                        data.message.means_of_transport_gross_tonnage +
                        ", KK " +
                        data.message.means_of_transport_net_tonnage +
                        ", (";
                    var city = "-";
                    if (
                        data.message.means_of_transport_port_of_registry &&
                        data.message.means_of_transport_registry_number
                    ) {
                        city =
                            data.message.means_of_transport_port_of_registry +
                            " " +
                            data.message.means_of_transport_registry_number;
                    }

                    var mname =
                        data.message.name +
                        "(" +
                        data.message.means_of_transport_type +
                        ")";

                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.fuel_name = mname;
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.fuel_address = address;
                    cur_frm.get_field(
                        "missing_xml_data"
                    ).grid.grid_rows[0].doc.fuel_city = city;
                    refresh_field("missing_xml_data");

                    frappe.call({
                        method: "frappe.client.get_value",
                        args: {
                            doctype: "Country",
                            fieldname: "code",
                            filters: {
                                name: ["=", data.message.means_of_transport_nationality],
                            },
                        },
                        freeze: true,
                        callback: function (res) {
                            cur_frm.get_field(
                                "missing_xml_data"
                            ).grid.grid_rows[0].doc.fuel_country = res.message.code.toUpperCase();
                            cur_frm.get_field(
                                "missing_xml_data"
                            ).grid.grid_rows[0].doc.fuel_address =
                                cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc
                                    .fuel_address +
                                res.message.code.toUpperCase() +
                                ")";
                            refresh_field("missing_xml_data");
                        },
                    });
                },
            });
        } else {
            frappe.msgprint("Fuel house master is missing");
        }
    }

    if (p.commodities_data[0].eu_permit) {
        cur_frm.get_field(
            "missing_xml_data"
        ).grid.grid_rows[0].doc.fuel_customer_name =
            p.customer + " " + p.commodities_data[0].eu_permit;
        refresh_field("missing_xml_data");
    } else {
        frappe.msgprint("EU Permit is missing in Commodities");
    }

    if (p.commodities_data[0].place_of_requested_delivery) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Place of Delivery",
                fieldname: "local_customs_authorities",
                filters: {
                    name: ["=", p.commodities_data[0].place_of_requested_delivery],
                },
            },
            freeze: true,
            callback: function (res) {
                cur_frm.get_field(
                    "missing_xml_data"
                ).grid.grid_rows[0].doc.fuel_customs =
                    res.message.local_customs_authorities;
                refresh_field("missing_xml_data");
            },
        });
    } else {
        frappe.msgprint("Place of delivery is missing");
    }

    if (
        p.customs_authorities_of_transpassing !=
        p.customs_authorities_of_import_or_export
    ) {
        cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.inltramodhea75 =
            p.internal_means_of_transport_code;
        refresh_field("missing_xml_data");
    }
    if (p.customs_warehouse) {
        ////////////Field 40///////////////////
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Customs Warehouse",
                filters: {
                    name: ["=", p.customs_warehouse],
                },
            },
            freeze: true,
            callback: function (res) {
                console.log(res);
                for (var e = 0; e < p.commodities_data.length; e++) {
                    console.log(p.commodities_data[e].preferential_status);

                    cur_frm.get_field("commodities_data").grid.grid_rows[
                        e
                    ].doc.predoctypar21 = "";
                    cur_frm.get_field("commodities_data").grid.grid_rows[
                        e
                    ].doc.predoccatpreadmref21 = "";
                    cur_frm.get_field("commodities_data").grid.grid_rows[
                        e
                    ].doc.predocmrnar1004 = "";
                    cur_frm.get_field("commodities_data").grid.grid_rows[
                        e
                    ].doc.predocitear1005 = "";
                    cur_frm.get_field("commodities_data").grid.grid_rows[
                        e
                    ].doc.predocquaar1006 = "";
                    cur_frm.get_field("commodities_data").grid.grid_rows[
                        e
                    ].doc.predocsumdecpacar1035 = "";
                    refresh_field("commodities_data");

                    if (
                        p.commodities_data[e].field_40_1 == "Z" &&
                        p.commodities_data[e].field_40_2 == "ZZZ"
                    ) {
                        cur_frm.get_field("commodities_data").grid.grid_rows[
                            e
                        ].doc.predoctypar21 = "ZZZ";
                        cur_frm.get_field("commodities_data").grid.grid_rows[
                            e
                        ].doc.predocrefar26 = p.commodities_data[e].field_40_3;
                        cur_frm.get_field("commodities_data").grid.grid_rows[
                            e
                        ].doc.predocreflng = "EN";
                        cur_frm.get_field("commodities_data").grid.grid_rows[
                            e
                        ].doc.predoccatpreadmref21 = "Z";
                    } else {
                        if (
                            res.message.is_free_zone == 1 &&
                            p.commodities_data[e].preferential_status != ""
                        ) {
                            console.log("Z-CLE");
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_1 = "Z";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_2 = "CLE";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_3 = p.manifest_number;
                            refresh_field("commodities_data");

                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoctypar21 = p.commodities_data[e].field_40_2;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocrefar26 = p.commodities_data[e].field_40_3;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocreflng = "EN";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoccatpreadmref21 = p.commodities_data[e].field_40_1;
                        } else if (
                            res.message.is_outside_of_free_zone == 1 &&
                            p.commodities_data[e].preferential_status != ""
                        ) {
                            console.log("Z-952 or Z-821");
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_1 = "Z";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_4 = p.commodities_data[e].record;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_5 = p.commodities_data[e].items;
                            refresh_field("commodities_data");

                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoctypar21 = p.commodities_data[e].field_40_2;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoccatpreadmref21 = p.commodities_data[e].field_40_1;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocmrnar1004 = p.commodities_data[e].field_40_3;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocitear1005 = p.commodities_data[e].field_40_4;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocquaar1006 = p.commodities_data[e].field_40_5;
                        } else if (
                            (typeof res.message.customs_warehouse_18_character ==
                                "undefined" ||
                                res.message.customs_warehouse_18_character != "0") &&
                            p.commodities_data[e].preferential_status != ""
                        ) {
                            console.log("Z-IM");
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_1 = "Z";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_2 = "IM";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_3 = p.missing_xml_data[0].for_field_40_3
                                .toString()
                                .replace("GRDH", "GRIM");
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_4 = p.commodities_data[e].record;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_5 = p.commodities_data[e].net_weight;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.wartypwaridgi10 = res.message.customs_warehouse_type;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.autcouwaridgi20 =
                                res.message.customs_warehouse_language_code;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.waridewaridegi19 =
                                res.message.customs_warehouse_18_character;
                            refresh_field("commodities_data");

                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoctypar21 = p.commodities_data[e].field_40_2;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoccatpreadmref21 = p.commodities_data[e].field_40_1;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocmrnar1004 = p.commodities_data[e].field_40_3;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocitear1005 = p.commodities_data[e].field_40_4;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocquaar1006 = p.commodities_data[e].field_40_5;
                        } else if (
                            p.commodities_data[e].preferential_status != "" &&
                            res.message.is_outside_of_free_zone == 0 &&
                            res.message.is_free_zone == 0 &&
                            (typeof res.message.customs_warehouse_18_character ==
                                "undefined" ||
                                res.message.customs_warehouse_18_character == "0")
                        ) {
                            console.log("X-337");
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_1 = "X";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_2 = "337";
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_3 = p.missing_xml_data[0].for_field_40_3;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_4 = p.commodities_data[e].record;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.field_40_5 = p.commodities_data[e].items;
                            refresh_field("commodities_data");

                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoctypar21 = p.commodities_data[e].field_40_2;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predoccatpreadmref21 = p.commodities_data[e].field_40_1;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocmrnar1004 = p.commodities_data[e].field_40_3;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocitear1005 = p.commodities_data[e].field_40_4;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocquaar1006 = p.commodities_data[e].field_40_5;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.predocsumdecpacar1035 = p.commodities_data[e].packaging;
                        }
                    }
                }
                refresh_field("commodities_data");
                frappe.model.set_value(p.doctype, p.name, "ready_for_xml", 1);
                msgprint("System is ready to create XML.");
                //cur_frm.save();
            },
        });

        ///////////////////////////////
    } else {
        refresh_field("commodities_data");
        frappe.model.set_value(p.doctype, p.name, "ready_for_xml", 1);
        msgprint("System is ready to create XML.");
        //cur_frm.save();
    }

    cur_frm.get_field("missing_xml_data").grid.grid_rows[0].doc.container =
        p.container;
    ///////////////////////////////////////////////////////
});

frappe.ui.form.on("Project", "create_xml_file", function (frm, cdt, cdn) {
    if (confirm("This will upload XML to KOMVOS, are you sure?")) {
        var p = frm.doc;
        var xmlcounter = p.xml_counter;

        if (p.mrn == undefined || p.mrn == "") {
            xmlcounter = p.xml_counter + 1;
        }

        frappe.call({
            method:
                "malco_erpnext.malco_erpnext.malco_erpnext.create_xml_file",
            args: {
                projname: p.name,
                counter: xmlcounter,
            },
            freeze: true,
            callback: function (r) {

                var saveData = (function () {
                    var a = document.createElement("a");
                    document.body.appendChild(a);
                    a.style = "display: none";
                    return function (data, fileName) {
                        //var json = JSON.stringify(data),
                        //blob = new Blob([json], {type: "octet/stream"}),
                        (blob = new Blob([data], {
                            type: "text/xml;charset=utf-8;",
                        })),
                            (url = window.URL.createObjectURL(blob));
                        a.href = url;
                        a.download = fileName;
                        a.click();
                        window.URL.revokeObjectURL(url);
                    };
                })();

                fileName = p.name + ".xml";
                saveData(r.message, fileName);
                cur_frm.reload_doc();
            }
        });
    }
});

frappe.ui.form.on("Project", "save_xml_locally", function (frm, cdt, cdn) {
    if (confirm("This will save XML to your drive and does NOT upload to KOMVOS, are you sure?")) {
        var p = frm.doc;
        var xmlcounter = p.xml_counter;

        if (p.mrn == undefined || p.mrn == "") {
            xmlcounter = p.xml_counter + 1;
        }

        frappe.call({
            method:
                "malco_erpnext.malco_erpnext.malco_erpnext.create_xml_file_locally",
            args: {
                projname: p.name,
                counter: xmlcounter,
            },
            freeze: true,
            callback: function (r) {

                var saveData = (function () {
                    var a = document.createElement("a");
                    document.body.appendChild(a);
                    a.style = "display: none";
                    return function (data, fileName) {
                        //var json = JSON.stringify(data),
                        //blob = new Blob([json], {type: "octet/stream"}),
                        (blob = new Blob([data], {
                            type: "text/xml;charset=utf-8;",
                        })),
                            (url = window.URL.createObjectURL(blob));
                        a.href = url;
                        a.download = fileName;
                        a.click();
                        window.URL.revokeObjectURL(url);
                    };
                })();

                fileName = p.name + ".xml";
                saveData(r.message, fileName);
                cur_frm.reload_doc();
            }
        });
    }
});

frappe.ui.form.on(
    "Project",
    "get_vessel_information",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Means of Transport",
                fieldname: "marine_traffic_url",
                filters: {
                    name: ["=", p.external_means_of_transport],
                },
            },
            freeze: true,
            callback: function (data) {
                window.open(data.message.marine_traffic_url, "_new");
            },
        });
    }
);

frappe.ui.form.on("Project", "track_vessel", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Means of Transport",
            fieldname: "marine_traffic_url",
            filters: {
                name: ["=", p.internal_means_of_transport_21],
            },
        },
        freeze: true,
        callback: function (data) {
            window.open(data.message.marine_traffic_url, "_new");
        },
    });
});

frappe.ui.form.on("Project", "tracking_bol", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Supplier",
            fieldname: "tracking_url",
            filters: {
                name: ["=", p.ocean_forwarder],
            },
        },
        freeze: true,
        callback: function (data) {
            window.open(data.message.tracking_url + "" + p.master_bol_or_cmr, "_new");
        },
    });
});

frappe.ui.form.on(
    "Container data",
    "track_container",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Supplier",
                fieldname: "tracking_url_container",
                filters: {
                    name: ["=", p.ocean_forwarder],
                },
            },
            freeze: true,
            callback: function (data) {
                window.open(
                    data.message.tracking_url_container + "" + d.container_number,
                    "_new"
                );
            },
        });
    }
);

frappe.ui.form.on("Commodities data", "warehouse", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    if (d.type_of_transaction == "1. eDE-eΔΕ") {
        if (d.warehouse.indexOf("eDE") > 0) {
        } else {
            frappe.model.set_value(d.doctype, d.name, "warehouse", "");
            msgprint("Invalid warehouse, please select correct warehouse");
        }
    } else if (d.type_of_transaction == "2. eLD-eΛΔ") {
        if (d.warehouse.indexOf("eLD") > 0) {
        } else {
            frappe.model.set_value(d.doctype, d.name, "warehouse", "");
            msgprint("Invalid warehouse, please select correct warehouse");
        }
    } else if (d.type_of_transaction == "0. Purchase-Αγορά") {
    }
});

frappe.ui.form.on("Commodities data", "stock_entry", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Stock Entry",
            filters: {
                name: ["=", d.stock_entry],
            },
        },
        freeze: true,
        callback: function (data) {
            if (data.message.to_warehouse != d.warehouse) {
                frappe.model.set_value(d.doctype, d.name, "warehouse", "");
                frappe.model.set_value(d.doctype, d.name, "stock_entry", "");
                msgprint("Invalid warehouse, please select correct Stock Entry");
            } else {
                if (data.message.stock_balance > 0) {
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "specific_weight",
                        data.message.items[0].specific_weight
                    );
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "uom",
                        data.message.items[0].uom
                    );
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "item_code",
                        data.message.items[0].item_code
                    );
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "hs_code",
                        data.message.items[0].item_code
                    );
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "means_of_transport",
                        data.message.means_of_transport
                    );
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "chemical_analysis_number",
                        data.message.chemical_analysis_number
                    );
                } else {
                    msgprint("Please check stock balance for selected STE.");
                }
            }
        },
    });
});

frappe.ui.form.on("Commodities data", "request", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Stock Entry",
            filters: {
                name: ["=", d.stock_entry],
            },
        },
        freeze: true,
        callback: function (data) {
            if (data.message.stock_balance > 0) {
                if (data.message.to_warehouse != d.warehouse) {
                    frappe.model.set_value(d.doctype, d.name, "warehouse", "");
                    frappe.model.set_value(d.doctype, d.name, "stock_entry", "");
                    msgprint("Invalid warehouse, please select correct Stock Entry");
                } else {
                    if (d.requested == 0) {
                        balance = flt(data.message.stock_balance) - flt(d.requested_qty);
                        console.log(balance);

                        frappe.call({
                            method: "frappe.client.set_value",
                            args: {
                                doctype: "Stock Entry",
                                name: d.stock_entry,
                                fieldname: "stock_balance",
                                value: balance,
                            },
                            freeze: true,
                            callback: function () {
                                console.log("Updated");
                                frappe.model.set_value(d.doctype, d.name, "requested", 1);
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "prev_requested_qty",
                                    d.requested_qty
                                );
                                cur_frm.save();
                            },
                        });
                    } else {
                        balance =
                            flt(data.message.stock_balance) +
                            flt(d.prev_requested_qty) -
                            flt(d.requested_qty);
                        console.log(balance);
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: {
                                doctype: "Stock Entry",
                                name: d.stock_entry,
                                fieldname: "stock_balance",
                                value: balance,
                            },
                            freeze: true,
                            callback: function () {
                                console.log("Updated");
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "prev_requested_qty",
                                    d.requested_qty
                                );
                                cur_frm.save();
                            },
                        });
                    }
                }
            } else {
                msgprint("Insufficient balance in select STE.");
            }
        },
    });

    if (d.uom == "Lts") {
        quantity_in_kgs = flt(d.specific_weight) * flt(d.requested_qty);
        frappe.model.set_value(
            d.doctype,
            d.name,
            "quantity_in_kgs",
            quantity_in_kgs.toFixed(2)
        );
    }
});

frappe.ui.form.on("Commodities data", "load", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    if (d.requested == 0) {
        msgprint("Please request quantity first.");
    } else {
        if (d.prev_requested_qty != d.loaded_qty) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Stock Entry",
                    filters: {
                        name: ["=", d.stock_entry],
                    },
                },
                freeze: true,
                callback: function (data) {
                    if (d.loaded == 0) {
                        balance =
                            flt(data.message.stock_balance) +
                            flt(d.prev_requested_qty) -
                            flt(d.loaded_qty);
                        console.log(balance);
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: {
                                doctype: "Stock Entry",
                                name: d.stock_entry,
                                fieldname: "stock_balance",
                                value: balance,
                            },
                            freeze: true,
                            callback: function () {
                                console.log("Updated");
                                frappe.model.set_value(d.doctype, d.name, "loaded", 1);
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "prev_loaded_qty",
                                    d.loaded_qty
                                );
                                cur_frm.save();
                            },
                        });
                    } else {
                        balance =
                            flt(data.message.stock_balance) +
                            flt(d.prev_loaded_qty) -
                            flt(d.loaded_qty);
                        console.log(balance);
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: {
                                doctype: "Stock Entry",
                                name: d.stock_entry,
                                fieldname: "stock_balance",
                                value: balance,
                            },
                            freeze: true,
                            callback: function () {
                                console.log("Updated");
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    "prev_loaded_qty",
                                    d.loaded_qty
                                );
                                cur_frm.save();
                            },
                        });
                    }
                },
            });
        } else {
            frappe.model.set_value(d.doctype, d.name, "loaded", 1);
            frappe.model.set_value(
                d.doctype,
                d.name,
                "prev_loaded_qty",
                d.loaded_qty
            );
            cur_frm.save();
        }
    }

    if (d.uom == "Lts") {
        quantity_in_kgs = flt(d.specific_weight) * flt(d.loaded_qty);
        frappe.model.set_value(
            d.doctype,
            d.name,
            "quantity_in_kgs",
            quantity_in_kgs.toFixed(2)
        );
    }
});

frappe.ui.form.on("Commodities data", "deliver", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    console.log("Deliver");

    if (d.loaded == 0) {
        msgprint("Please load quantity first.");
    } else {
        if (d.prev_loaded_qty != d.delivered_qty) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Stock Entry",
                    filters: {
                        name: ["=", d.stock_entry],
                    },
                },
                freeze: true,
                callback: function (data) {
                    balance =
                        flt(data.message.stock_balance) +
                        flt(d.prev_loaded_qty) -
                        flt(d.delivered_qty);
                    console.log(balance);
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: {
                            doctype: "Stock Entry",
                            name: d.stock_entry,
                            fieldname: "stock_balance",
                            value: balance,
                        },
                        freeze: true,
                        callback: function () {
                            if (
                                p.customs_document_type != "Fuel Supply - Material Transfer"
                            ) {
                                console.log("Updated");
                                t = new Array();
                                t[0] = {
                                    s_warehouse: d.warehouse,
                                    item_code: d.item_code,
                                    qty: d.delivered_qty,
                                    UOM: d.uom,
                                    cost_center: "Main - MalCo",
                                    difference_account: "Stock Adjustment - MalCo",
                                };

                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: {
                                        doc: {
                                            doctype: "Stock Entry",
                                            naming_series: "DSTE-",
                                            purpose: "Material Issue",
                                            from_warehouse: d.warehouse,
                                            project_reference: p.project_name,
                                            project: p.project_name,
                                            ste_loading_reference: d.stock_entry,
                                            items: t,
                                        },
                                    },
                                    freeze: true,
                                    callback: function (data) {
                                        console.log(data.message.name);
                                        frappe.model.set_value(d.doctype, d.name, "delivered", 1);
                                        frappe.model.set_value(
                                            d.doctype,
                                            d.name,
                                            "delivery_stock_entry",
                                            data.message.name
                                        );
                                    },
                                });
                            } else {
                                console.log("Updated");
                                nseries = d.eu_permit + "-2017-STE-";
                                t = new Array();
                                t[0] = {
                                    s_warehouse: d.warehouse,
                                    t_warehouse: d.to_warehouse,
                                    item_code: d.item_code,
                                    qty: d.delivered_qty,
                                    UOM: d.uom,
                                    cost_center: "Main - MalCo",
                                    difference_account: "Stock Adjustment - MalCo",
                                };

                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: {
                                        doc: {
                                            doctype: "Stock Entry",
                                            naming_series: nseries,
                                            purpose: "Material Transfer",
                                            from_warehouse: d.warehouse,
                                            to_warehouse: d.to_warehouse,
                                            project_reference: p.project_name,
                                            project: p.project_name,
                                            ste_loading_reference: d.stock_entry,
                                            items: t,
                                        },
                                    },
                                    freeze: true,
                                    callback: function (data) {
                                        console.log(data.message.name);
                                        frappe.model.set_value(d.doctype, d.name, "delivered", 1);
                                        frappe.model.set_value(
                                            d.doctype,
                                            d.name,
                                            "delivery_stock_entry",
                                            data.message.name
                                        );
                                    },
                                });
                            }
                        },
                    });
                },
            });
        } else {
            if (p.customs_document_type != "Fuel Supply - Material Transfer") {
                console.log("Updated");
                t = new Array();
                t[0] = {
                    s_warehouse: d.warehouse,
                    item_code: d.item_code,
                    qty: d.delivered_qty,
                    UOM: d.uom,
                    cost_center: "Main - MalCo",
                    difference_account: "Stock Adjustment - MalCo",
                };

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Stock Entry",
                            naming_series: "DSTE-",
                            purpose: "Material Issue",
                            from_warehouse: d.warehouse,
                            project_reference: p.project_name,
                            project: p.project_name,
                            ste_loading_reference: d.stock_entry,
                            items: t,
                        },
                    },
                    freeze: true,
                    callback: function (data) {
                        console.log(data.message.name);
                        frappe.model.set_value(d.doctype, d.name, "delivered", 1);
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            "delivery_stock_entry",
                            data.message.name
                        );
                    },
                });
            } else {
                console.log("Updated");
                nseries = d.eu_permit + "-2017-STE-";
                t = new Array();
                t[0] = {
                    s_warehouse: d.warehouse,
                    t_warehouse: d.to_warehouse,
                    item_code: d.item_code,
                    qty: d.delivered_qty,
                    UOM: d.uom,
                    cost_center: "Main - MalCo",
                    difference_account: "Stock Adjustment - MalCo",
                };

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Stock Entry",
                            naming_series: nseries,
                            purpose: "Material Transfer",
                            from_warehouse: d.warehouse,
                            to_warehouse: d.to_warehouse,
                            project_reference: p.project_name,
                            project: p.project_name,
                            ste_loading_reference: d.stock_entry,
                            items: t,
                        },
                    },
                    freeze: true,
                    callback: function (data) {
                        console.log(data.message.name);
                        frappe.model.set_value(d.doctype, d.name, "delivered", 1);
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            "delivery_stock_entry",
                            data.message.name
                        );
                    },
                });
            }
        }
    }

    if (d.uom == "Lts") {
        quantity_in_kgs = flt(d.specific_weight) * flt(d.delivered_qty);
        frappe.model.set_value(
            d.doctype,
            d.name,
            "quantity_in_kgs",
            quantity_in_kgs.toFixed(2)
        );
    }
});

frappe.ui.form.on(
    "Commodities data",
    "delivery_stock_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Stock Entry",
                filters: {
                    name: ["=", d.delivery_stock_entry],
                },
            },
            freeze: true,
            callback: function (data) {
                data.message["doctype"] = "Stock Entry";

                frappe.call({
                    method: "frappe.client.submit",
                    args: {
                        doc: data.message,
                    },
                    freeze: true,
                    callback: function (res) {
                        console.log(res);
                        setTimeout(function () {
                            cur_frm.save();
                        }, 3000);
                    },
                });
            },
        });
    }
);

frappe.ui.form.on(
    "Commodities data",
    "cancel_delivery",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.cancel",
            args: {
                doctype: "Stock Entry",
                name: d.delivery_stock_entry,
            },
            freeze: true,
            callback: function (data) {
                setTimeout(function () {
                    frappe.model.set_value(d.doctype, d.name, "delivered", 0);
                    frappe.model.set_value(d.doctype, d.name, "delivery_stock_entry", "");
                    cur_frm.save();
                }, 3000);
            },
        });
    }
);

frappe.ui.form.on(
    "Commodities data",
    "cancel_project_delivery",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Stock Entry",
                filters: {
                    name: ["=", d.stock_entry],
                },
            },
            freeze: true,
            callback: function (data) {
                if (prev_requested_qty > prev_loaded_qty) {
                    balance = flt(data.message.stock_balance) + flt(d.prev_requested_qty);
                } else {
                    balance = flt(data.message.stock_balance) + flt(d.prev_loaded_qty);
                }

                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: "Stock Entry",
                        name: d.stock_entry,
                        fieldname: "stock_balance",
                        value: balance,
                    },
                    freeze: true,
                    callback: function () {
                        console.log("Updated");
                        frappe.model.set_value(d.doctype, d.name, 1, d.cancelled_project);
                        cur_frm.save();
                    },
                });
            },
        });
    }
);

frappe.ui.form.on("Consulting Notes", "end", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var total_hours = 0.0;
    for (var i = 0; i < p.consulting_notes.length; i++) {
        var d1 = new Date(p.consulting_notes[i].end);
        var d2 = new Date(p.consulting_notes[i].start);
        var hours = (Math.abs(d1.getTime() - d2.getTime()) / 36e5).toFixed(1);
        total_hours = flt(total_hours) + flt(hours);
    }
    frappe.model.set_value(p.doctype, p.name, "total_hours_spent", total_hours);
    var diff = flt(p.total_hours_spent) - flt(p.standard_monthly_time);
    if (diff > 0) {
        frappe.model.set_value(p.doctype, p.name, "excess_hours_spent", diff);
    } else {
        frappe.model.set_value(p.doctype, p.name, "excess_hours_spent", 0);
    }
});

frappe.ui.form.on("Project", "send_newsletter", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var header = p.consulting_email_header || "";
    var emails = p.consulting_emails || "";

    var message = header + "</br></br>";
    for (var i = 0; i < p.consulting_notes.length; i++) {
        if (
            p.consulting_notes[i].is_registered != 1 &&
            p.consulting_notes[i].type != "Ad-hock"
        ) {
            message = message + p.consulting_notes[i].notes + "</br></br>";
        }
    }

    var composer = new frappe.views.CommunicationComposer({
        doc: cur_frm.doc,
        frm: cur_frm,
        subject: "Project: " + p.name,
        recipients: emails,
        attach_document_print: false,
        message: message,
    });

    composer.dialog.set_value("send_me_a_copy", true);
});

frappe.ui.form.on("Consulting Notes", "send_email", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var header = p.consulting_email_header || "";
    var emails = p.consulting_emails || "";

    if (d.is_registered == 0 && d.type == "Ad-hock") {
        message = message + d.question + "</br></br>" + d.notes + "</br></br>";

        var composer = new frappe.views.CommunicationComposer({
            doc: cur_frm.doc,
            frm: cur_frm,
            subject: "Project: " + p.name,
            recipients: emails,
            attach_document_print: false,
            message: message,
        });

        composer.dialog.set_value("send_me_a_copy", true);
    }

    /*
              frappe.call({
                              "method": "frappe.client.get",
                              args: {
                                  doctype: "Stock Entry",
                                  filters: {
                                      name:["=", '1231564']
                                      }		
                                  },
                              freeze: true,	
                              callback: function (data) {
                                  console.log(data);
  
                              }
  
                          })
              */
});

frappe.ui.form.on("Commodities data", "item_code", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "HS_Code",
            filters: {
                item_: ["=", d.item_code],
            },
            limit_page_length: 500,
        },
        freeze: true,
        callback: function (data) {
            console.log(data);
            frappe.model.set_value(
                d.doctype,
                d.name,
                "hs_code",
                data.message[0].name
            );
        },
    });
});

frappe.ui.form.on("Project", "update_currency_rate", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Customs currency rates",

            filters: {
                currency: ["=", p.commercial_invoice_currency],
                currency_start_date: ["<=", p.date_of_customs_declaration],
            },
            order_by: "name",
            limit_page_length: 500,
        },
        freeze: true,
        callback: function (data) {
            console.log(data);

            var getname = data.message[data.message.length - 1].name;
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Customs currency rates",
                    fieldname: "customs_currency_rate",
                    filters: {
                        name: ["=", getname],
                    },
                },
                freeze: true,
                callback: function (data) {
                    console.log(data);
                    if (
                        p.commercial_invoice_currency_rate !=
                        data.message.customs_currency_rate
                    ) {
                        frappe.model.set_value(
                            p.doctype,
                            p.name,
                            "commercial_invoice_currency_rate",
                            data.message.customs_currency_rate
                        );

                        for (var e = 0; e < p.commodities_data.length; e++) {
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.commercial_price_currency = p.commercial_invoice_currency;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.freight_currency = p.commercial_invoice_currency;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.insurance_currency = p.commercial_invoice_currency;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.commercial_price_currency_rate =
                                p.commercial_invoice_currency_rate;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.freight_currency_rate = p.commercial_invoice_currency_rate;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.insurance_currency_rate =
                                p.commercial_invoice_currency_rate;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.commercial_price = p.commercial_invoice_value;
                            refresh_field("commodities_data");

                            var obitotal =
                                flt(p.commodities_data[e].commercial_price) /
                                flt(p.commodities_data[e].commercial_price_currency_rate);
                            var ofitotal =
                                flt(p.commodities_data[e].freight) /
                                flt(p.commodities_data[e].freight_currency_rate);
                            var oiitotal =
                                flt(p.commodities_data[e].insurance) /
                                flt(p.commodities_data[e].insurance_currency_rate);

                            var oteuro_total = flt(obitotal) + flt(ofitotal) + flt(oiitotal);

                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.total_value = oteuro_total;
                            cur_frm.get_field("commodities_data").grid.grid_rows[
                                e
                            ].doc.statistical_value = oteuro_total;
                            refresh_field("commodities_data");
                        }
                    }
                },
            });
        },
    });
});
/*
        frappe.ui.form.on("Container data", "container_check", function(frm,cdt,cdn) {	
                    var p = frm.doc;
                    var d = locals[cdt][cdn];	
                	
                	
                            	
                    function ISO6346Check(con) {
                        if (!con || con == "" || con.length != 11) { return false; }
                        con = con.toUpperCase();
                        var re = /^[A-Z]{4}\d{7}/;
                        if (re.test(con)) {
                            var sum = 0;
                            for (i = 0; i < 10; i++) {
                                var n = con.substr(i, 1);
                                if (i < 4) {
                                    n = "0123456789A?BCDEFGHIJK?LMNOPQRSTU?VWXYZ".indexOf(con.substr(i, 1));
                                }
                                n *= Math.pow(2, i); 
                                sum += n;
                            }
                            if (con.substr(0, 4) == "HLCU") {
                                sum -= 2;
                            }
                            sum %= 11;
                            sum %= 10;
                            frappe.msgprint("Last digit should be "+sum);		
                            return sum == con.substr(10);
                        } else {
                            return false;  
                        }
                    }
                	
                    if (ISO6346Check(d.container_check)){
                        frappe.msgprint("Container Number is correct as per ISO6346.");	
                        $('input[data-fieldname="container_check"]').css("background-color","#98FB98")
                    }else{
                        frappe.msgprint("Wrong!!! Container Number is wrong as per ISO6346.");	
                        $('input[data-fieldname="container_check"]').css("background-color","#FFE4C4")
                    }
                	
        });
        */
$(document).ajaxStop(function () {
    //  $( ".log" ).text( "Triggered ajaxStop handler." );
    console.log("Triggered ajaxStop handler.");
});

frappe.ui.form.on("Project", "email_eta", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Means of Transport",
            fieldname: "marine_traffic_url",
            filters: {
                name: ["=", p.external_means_of_transport],
            },
        },
        freeze: true,
        callback: function (data) {
            frappe.model.set_value(
                p.doctype,
                p.name,
                "marine_traffic_link",
                data.message.marine_traffic_url
            );

            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Address",
                    fieldname: "email_id",
                    filters: {
                        name: ["=", getname],
                    },
                },
                freeze: true,
                callback: function (data) {
                    console.log(data.message.email_id);
                    var composer = new frappe.views.CommunicationComposer({
                        doc: cur_frm.doc,
                        frm: cur_frm,
                        subject: "Project: " + p.name,
                        recipients: data.message.email_id,
                        attach_document_print: false,
                    });

                    composer.dialog.set_value("standard_reply", "ETA EN");
                    composer.dialog.set_value("send_me_a_copy", true);
                },
            });
        },
    });
});

frappe.ui.form.on("Project", "email_eta_gr", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Means of Transport",
            fieldname: "marine_traffic_url",
            filters: {
                name: ["=", p.external_means_of_transport],
            },
        },
        freeze: true,
        callback: function (data) {
            frappe.model.set_value(
                p.doctype,
                p.name,
                "marine_traffic_link",
                data.message.marine_traffic_url
            );

            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Address",
                    fieldname: "email_id",
                    filters: {
                        name: ["=", getname],
                    },
                },
                freeze: true,
                callback: function (data) {
                    console.log(data.message.email_id);
                    var composer = new frappe.views.CommunicationComposer({
                        doc: cur_frm.doc,
                        frm: cur_frm,
                        subject: "Project: " + p.name,
                        recipients: data.message.email_id,
                        attach_document_print: false,
                    });

                    composer.dialog.set_value("standard_reply", "ETA GR");
                    composer.dialog.set_value("send_me_a_copy", true);
                },
            });
        },
    });
});

frappe.ui.form.on("Project", "email_delivery", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Delivery EN");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "email_delivery_gr", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Delivery GR");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "multi_hs_code", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "malco_erpnext.malco_erpnext.malco_erpnext.remove_duplicate_tags",
        args: {
            project: p.name,
        },
        freeze: true,
        callback: function (r) {
            console.log(r.message);

            //frappe.model.set_value(p.doctype, p.name, "xml_html", r);

            //var xml_d = content.replace(/<br>/g, "\n");
            //frappe.model.set_value(p.doctype, p.name, "xml", r.message);
            var saveData = (function () {
                var a = document.createElement("a");
                document.body.appendChild(a);
                a.style = "display: none";
                return function (data, fileName) {
                    //var json = JSON.stringify(data),
                    //blob = new Blob([json], {type: "octet/stream"}),
                    (blob = new Blob([data], {
                        type: "text/xml;charset=utf-8;",
                    })),
                        (url = window.URL.createObjectURL(blob));
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    window.URL.revokeObjectURL(url);
                };
            })();

            var data = $("<div/>").html(r.message.toString());
            fileName = p.name + ".xml";
            saveData(r.message, fileName);
        },
    });
});

frappe.ui.form.on("Project", "email_landed_gr", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Landed GR");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "email_landed_en", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Landed EN");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "email_local_forwarder_gr", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Local forwarder Info GR");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "email_local_forwarder_en", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Local forwarder Info EN");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "email_finished_gr", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Finished GR");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on("Project", "email_finished_en", function (frm, cdt, cdn) {
    var me = this;
    var p = frm.doc;
    var d = locals[cdt][cdn];
    var getname = p.invoiced_to_payer + "-Billing";
    var message = "";
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Address",
            fieldname: "email_id",
            filters: {
                name: ["=", getname],
            },
        },
        freeze: true,
        callback: function (data) {
            console.log(data.message.email_id);
            var composer = new frappe.views.CommunicationComposer({
                doc: cur_frm.doc,
                frm: cur_frm,
                subject: "Project: " + p.name,
                recipients: data.message.email_id,
                attach_document_print: false,
            });

            composer.dialog.set_value("standard_reply", "Finished EN");
            composer.dialog.set_value("send_me_a_copy", true);
        },
    });
});

frappe.ui.form.on(
    "Project",
    "delete_draft_quotation",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Quotation",
                name: p.quotation_no,
            },
            freeze: true,
            callback: function (data) {
                console.log(data);
                frappe.model.set_value(p.doctype, p.name, "is_quotation_created", 0);
                frappe.model.set_value(p.doctype, p.name, "quotation_no", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "delete_draft_sales_order",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Sales Order",
                name: p.sales_order_no,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(p.doctype, p.name, "is_sales_order_created", 0);
                frappe.model.set_value(p.doctype, p.name, "sales_order_no", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "delete_draft_payment_voucher",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Journal Entry",
                name: p.payment_voucher_no,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(
                    p.doctype,
                    p.name,
                    "is_payment_request_created",
                    0
                );
                frappe.model.set_value(p.doctype, p.name, "payment_voucher_no", "");
                frappe.model.set_value(
                    p.doctype,
                    p.name,
                    "payment_voucher_confirmed",
                    0
                );
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "delete_draft_delivery_note",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Delivery Note",
                name: p.delivery_note_no,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(
                    p.doctype,
                    p.name,
                    "is_delivery_note_created",
                    0
                );
                frappe.model.set_value(p.doctype, p.name, "delivery_note_no", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on("Project", "delete_draft_invoice", function (frm, cdt, cdn) {
    var p = frm.doc;
    frappe.call({
        method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
        args: {
            doctype: "Sales Invoice",
            name: p.invoice_no,
        },
        freeze: true,
        callback: function (data) {
            frappe.model.set_value(p.doctype, p.name, "is_invoice_created", 0);
            for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                if (frm.doc.invoice_analysis[e].ref_invoice_no == p.invoice_no) {
                    frm.doc.invoice_analysis[e].is_invoiced = 0;
                    frm.doc.invoice_analysis[e].ref_invoice_no = "";
                }
            }
            frappe.model.set_value(p.doctype, p.name, "invoice_no", "");
            cur_frm.save();
        },
    });
});

frappe.ui.form.on(
    "Invoicing status",
    "delete_draft_invoice",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Sales Invoice",
                name: d.invoice_no,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(d.doctype, d.name, "invoice_created", 0);
                for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                    if (frm.doc.invoice_analysis[e].ref_invoice_no == d.invoice_no) {
                        frm.doc.invoice_analysis[e].is_invoiced = 0;
                        frm.doc.invoice_analysis[e].ref_invoice_no = "";
                    }
                }
                frappe.model.set_value(d.doctype, d.name, "invoice_no", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Delivery note status",
    "delete_draft_delivery_note",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Delivery Note",
                name: d.delivery_note_no,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(d.doctype, d.name, "delivery_note_created", 0);
                frappe.model.set_value(d.doctype, d.name, "delivery_note_no", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on("Project", "voucher_type", function (frm, cdt, cdn) {
    var p = frm.doc;

    if (p.voucher_type == "Cash Entry") {
        frappe.model.set_value(
            p.doctype,
            p.name,
            "payment_account",
            "Cash - MalCo"
        );
    } else {
        frappe.model.set_value(p.doctype, p.name, "payment_account", "");
    }
});

frappe.ui.form.on("Project", "cancel_quotation", function (frm, cdt, cdn) {
    var p = frm.doc;

    frappe.call({
        method: "frappe.client.cancel",
        args: {
            doctype: "Quotation",
            name: p.quotation_no,
        },
        freeze: true,
        callback: function (data) {
            setTimeout(function () {
                frappe.model.set_value(p.doctype, p.name, "quotation_confirmed", 0);
                frappe.model.set_value(p.doctype, p.name, "is_quotation_created", 0);
                frappe.model.set_value(p.doctype, p.name, "quotation_no", "");
            }, 3000);
        },
    });
});

frappe.ui.form.on(
    "Project",
    "cancel_payment_voucher",
    function (frm, cdt, cdn) {
        var p = frm.doc;

        frappe.call({
            method: "frappe.client.cancel",
            args: {
                doctype: "Journal Entry",
                name: p.payment_voucher_no,
            },
            freeze: true,
            callback: function (data) {
                setTimeout(function () {
                    frappe.model.set_value(
                        p.doctype,
                        p.name,
                        "is_payment_request_created",
                        0
                    );
                    frappe.model.set_value(
                        p.doctype,
                        p.name,
                        "payment_voucher_confirmed",
                        0
                    );
                    frappe.model.set_value(p.doctype, p.name, "payment_voucher_no", "");
                    cur_frm.save();
                }, 3000);
            },
        });
    }
);

frappe.ui.form.on("Project User", "user", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Contact",

            filters: {
                user: ["=", d.user],
            },
            order_by: "name",
            limit_page_length: 500,
        },
        freeze: true,
        callback: function (data) {
            if (data.message.length > 0) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "user_contact",
                    data.message[0].name
                );
            }
        },
    });
});

frappe.ui.form.on("Cost analysis", "mode_of_payment", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    frappe.call({
        method:
            "erpnext.accounts.doctype.journal_entry.journal_entry.get_default_bank_cash_account",
        args: {
            mode_of_payment: d.mode_of_payment,
            company: p.company,
        },
        freeze: true,
        callback: function (r) {
            console.log(r);
            if (r.message) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "from_account",
                    r.message.account
                );
            }
        },
    });
});

frappe.ui.form.on("Cost analysis", "payment_to", function (frm, cdt, cdn) {
    var p = frm.doc;
    var d = locals[cdt][cdn];
    frappe.call({
        method:
            "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details",
        args: {
            company: p.company,
            party_type: "Supplier",
            party: d.payment_to,
            date: p.expected_start_date,
        },
        freeze: true,
        callback: function (r, rt) {
            if (r.message) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "to_account",
                    r.message.party_account
                );
            }
        },
    });
});

frappe.ui.form.on(
    "Cost analysis",
    "create_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        var today = new Date();

        frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: {
                    doctype: "Payment Entry",
                    payment_type: "Pay",
                    posting_date: d.date_of_payment,
                    mode_of_payment: d.mode_of_payment,
                    party_type: "Supplier",
                    party: d.payment_to,
                    paid_from: d.from_account,
                    paid_to: d.to_account,
                    paid_amount: d.total_billing_value,
                    received_amount: d.total_billing_value,
                    source_exchange_rate: 1,
                    target_exchange_rate: 1,
                    reference_no: p.project_name,
                    reference_date: d.date_of_payment,
                    project: p.project_name,
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data.message.name);
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "payment_entry",
                    data.message.name
                );
                frappe.model.set_value(d.doctype, d.name, "payment_entry_created", 1);
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "delete_draft_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Payment Entry",
                name: d.payment_entry,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(d.doctype, d.name, "payment_entry_created", 0);
                frappe.model.set_value(d.doctype, d.name, "payment_entry", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "confirm_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Payment Entry",
                filters: {
                    name: ["=", d.payment_entry],
                },
            },
            async: false,
            freeze: true,
            callback: function (data) {
                data.message["doctype"] = "Payment Entry";

                frappe.call({
                    method: "frappe.client.submit",
                    args: {
                        doc: data.message,
                    },
                    async: false,
                    freeze: true,
                    callback: function (res) {
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            "payment_entry_confirmed",
                            1
                        );
                    },
                });
            },
        });

        docr = new Date(p.date_of_customs_declaration);
        cutoff = new Date("2018-04-30");
        if (docr > cutoff) {
            frappe.call({
                method:
                    "malco_erpnext.malco_erpnext.malco_erpnext.book_expense_project",
                args: {
                    proj: p.name,
                    tbv: d.total_billing_value,
                    supplier: d.payment_to,
                    payment_date: d.date_of_payment,
                },
                async: false,
                freeze: true,
                callback: function (data) {
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "journal_entry",
                        data.message.name
                    );
                    cur_frm.save();
                },
            });
        } else {
            cur_frm.save();
        }
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "cancel_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.cancel",
            args: {
                doctype: "Payment Entry",
                name: d.payment_entry,
            },
            async: false,
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(d.doctype, d.name, "payment_entry_confirmed", 0);
                frappe.model.set_value(d.doctype, d.name, "payment_entry_created", 0);
                frappe.model.set_value(d.doctype, d.name, "payment_entry", "");
            },
        });

        if (d.journal_entry) {
            frappe.call({
                method: "frappe.client.cancel",
                args: {
                    doctype: "Journal Entry",
                    name: d.journal_entry,
                },
                async: false,
                freeze: true,
                callback: function (data) {
                    frappe.model.set_value(d.doctype, d.name, "journal_entry", "");
                    cur_frm.save();
                },
            });
        } else {
            cur_frm.save();
        }
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "mode_of_reverse_payment",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        frappe.call({
            method:
                "erpnext.accounts.doctype.journal_entry.journal_entry.get_default_bank_cash_account",
            args: {
                mode_of_payment: d.mode_of_reverse_payment,
                company: p.company,
            },
            freeze: true,
            callback: function (r) {
                console.log(r);
                if (r.message) {
                    frappe.model.set_value(
                        d.doctype,
                        d.name,
                        "reverse_to_account",
                        r.message.account
                    );
                }
            },
        });
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "create_reverse_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        var today = new Date();

        // frappe.call({
        //     "method": "frappe.client.insert",
        //     args: {
        //         doc: {
        //             doctype: "Payment Entry",
        //             "payment_type": "Receive",
        //             "posting_date": d.reverse_payment_date,
        //             "mode_of_payment": d.mode_of_reverse_payment,
        //             "party_type": "Supplier",
        //             "party": d.payment_to,
        //             "paid_from": d.to_account,
        //             "paid_to": d.reverse_to_account,
        //             "paid_amount": d.total_billing_value,
        //             "received_amount": d.total_billing_value,
        //             "source_exchange_rate": 1,
        //             "target_exchange_rate": 1,
        //             "reference_no": p.project_name,
        //             "reference_date": d.reverse_payment_date,
        //             "project": p.project_name
        //         }
        //     },
        //     freeze: true,
        //     callback: function(data) {
        //         console.log(data.message.name);
        //         frappe.model.set_value(d.doctype, d.name, "reverse_payment_entry", data.message.name);
        //         frappe.model.set_value(d.doctype, d.name, "reverse_payment_entry_created", 1);
        //         cur_frm.save();
        //     }
        // })
        t = new Array();

        t[0] = {
            account: d.reverse_to_account,
            cost_center: "Main - MalCo",
            debit_in_account_currency: d.total_billing_value,
        };

        t[1] = {
            account: d.to_account,
            party_type: "Supplier",
            party: d.payment_to,
            cost_center: "Main - MalCo",
            credit_in_account_currency: d.total_billing_value,
            is_advance: "No",
        };

        frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: {
                    doctype: "Journal Entry",
                    voucher_type: "Journal Entry",
                    posting_date: d.reverse_payment_date,
                    cheque_no: p.project_name,
                    cheque_date: d.reverse_payment_date,
                    accounts: t,
                    project_reference: p.project_name,
                    project: p.project_name,
                },
            },
            freeze: true,
            callback: function (data) {
                console.log(data.message.name);
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "reverse_payment_entry",
                    data.message.name
                );
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "reverse_payment_entry_created",
                    1
                );
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "delete_draft_reverse_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.delete_doc_force",
            args: {
                doctype: "Journal Entry",
                name: d.reverse_payment_entry,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "reverse_payment_entry_created",
                    0
                );
                frappe.model.set_value(d.doctype, d.name, "reverse_payment_entry", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "confirm_reverse_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Journal Entry",
                filters: {
                    name: ["=", d.reverse_payment_entry],
                },
            },
            freeze: true,
            callback: function (data) {
                data.message["doctype"] = "Journal Entry";

                frappe.call({
                    method: "frappe.client.submit",
                    args: {
                        doc: data.message,
                    },
                    freeze: true,
                    callback: function (res) {
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            "reverse_payment_entry_confirmed",
                            1
                        );
                        cur_frm.save();
                    },
                });
            },
        });
    }
);

frappe.ui.form.on(
    "Cost analysis",
    "cancel_reverse_payment_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        var d = locals[cdt][cdn];

        frappe.call({
            method: "frappe.client.cancel",
            args: {
                doctype: "Journal Entry",
                name: d.reverse_payment_entry,
            },
            freeze: true,
            callback: function (data) {
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "reverse_payment_entry_created",
                    0
                );
                frappe.model.set_value(
                    d.doctype,
                    d.name,
                    "reverse_payment_entry_confirmed",
                    0
                );
                frappe.model.set_value(d.doctype, d.name, "reverse_payment_entry", "");
                cur_frm.save();
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "create_costs_journal_entry",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.book_expenses_project",
            args: {
                proj: p.name,
            },
            freeze: true,
            callback: function (data) {
                frappe.msgprint("Expense Voucher created");
            },
        });
    }
);

frappe.ui.form.on("Project", "cac_user", function (frm, cdt, cdn) {
    var p = frm.doc;
    var current_cac = p.cac_user;
    if (p.cac_user) {
        if (p.cac_permission) {
            frappe.call({
                method: "frappe.client.set_value",
                args: {
                    doctype: "User Permission",
                    name: p.cac_permission,
                    fieldname: "user",
                    value: p.cac_user,
                },
                freeze: true,
                callback: function () {
                    frappe.msgprint("Permissions Updated");
                    cur_frm.save();
                },
            });
        } else {
            frappe.call({
                method: "frappe.client.insert",
                args: {
                    doc: {
                        doctype: "User Permission",
                        user: p.cac_user,
                        allow: "Project",
                        for_value: p.name,
                        apply_for_all_roles: 1,
                    },
                },
                freeze: true,
                callback: function (data) {
                    console.log(data.message.name);
                    frappe.model.set_value(
                        p.doctype,
                        p.name,
                        "cac_permission",
                        data.message.name
                    );
                    frappe.msgprint("Permissions Updated");
                    cur_frm.save();
                },
            });
        }
    }
});

frappe.ui.form.on(
    "Project",
    "customer_general_ledger",
    function (frm, cdt, cdn) {
        var p = frm.doc;
        if (p.customer) {
            var query =
                "/desk#query-report/General%20Ledger?party_type=Customer&party=" +
                p.customer;
            window.open(query, "_blank");
        } else {
            frappe.msgprint("Please select Customer First");
        }
    }
);

frappe.ui.form.on(
    "Project",
    "upload_xml_via_komvos",
    function (frm) {
        var p = frm.doc;

        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.create_xml_file_for_komvos",
            args: {
                proj: p.name,
            },
            freeze: true,
            callback: function (data) {
                frappe.msgprint("XML file created for Komvos processing.");
            },
        });
    }
);

frappe.ui.form.on(
    "Project",
    "compare_with_past_expenses",
    function (frm) {
        var p = frm.doc;

        frappe.call({
            method: "malco_erpnext.malco_erpnext.malco_erpnext.compare_with_past_expenses",
            args: {
                proj: p.name,
            },
            freeze: true,
            callback: function (data) {
                let cols_cpe = new Map();
                let cols_ccf = new Map();

                let current_row = false;

                for (i = 0; i < data.message.length; i++) {
                    if (data.message[i]["billing_account"] == 'Έκτακτες δαπάνες εντός Τελωνείου - Customs procedures expenses') {
                        if (cols_cpe.has(data.message[i]["parent"])) {
                            cols_cpe.set(data.message[i]["parent"], cols_cpe.get(data.message[i]["parent"]) + "<td>" + data.message[i]["billing_value"] + "</td>");
                        } else {
                            cols_cpe.set(data.message[i]["parent"], "<td>" + data.message[i]["billing_value"] + "</td>");
                        }
                    }
                    if (data.message[i]["billing_account"] == 'Παροχή Υπηρεσιών - Customs clearance fees') {
                        if (cols_ccf.has(data.message[i]["parent"])) {
                            cols_ccf.set(data.message[i]["parent"], cols_ccf.get(data.message[i]["parent"]) + "<td>" + data.message[i]["billing_value"] + "</td>");
                        } else {
                            cols_ccf.set(data.message[i]["parent"], "<td>" + data.message[i]["billing_value"] + "</td>");
                        }
                    }
                }

                let tbl = "<table class='table table-striped'><thead><tr><th>Project</th><th>Customs procedures expenses</th><th>Customs clearance fees</th></thead></tr>";

                Array.from(cols_cpe.keys()).forEach(k => {
                    if (k == p.name) {
                        current_row = true;
                        tbl = tbl + "<tr><td>" + k + " (current)</td>" + cols_cpe.get(k) + cols_ccf.get(k) + "</tr>";
                    } else {
                        tbl = tbl + "<tr style='color:red;'><td>" + k + "</td>" + cols_cpe.get(k) + cols_ccf.get(k) + "</tr>";
                    }

                });

                if (!current_row) {
                    let currow = "<tr><td>" + p.name + " (current)</td>";
                    for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
                        if (frm.doc.invoice_analysis[e].billing_account == 'Έκτακτες δαπάνες εντός Τελωνείου - Customs procedures expenses') {
                            currow = currow + "<td>" + frm.doc.invoice_analysis[e].billing_value + "</td>";
                        }
                        if (frm.doc.invoice_analysis[e].billing_account == 'Παροχή Υπηρεσιών - Customs clearance fees') {
                            currow = currow + "<td>" + frm.doc.invoice_analysis[e].billing_value + "</td>";
                        }
                    }

                    tbl = tbl + currow + "</tr>";
                }

                tbl += "</table>";

                frappe.msgprint(tbl);
            },
        });
    }
);


frappe.ui.form.on(
    "Project",
    "upload_files_to_icisnet",
    function (frm) {
        var p = frm.doc;

        if (p.mrn == "" || p.mrn == undefined) {
            frappe.msgprint("Project must have MRN to upload files to ICISnet");
            return
        }

        var files = cur_frm.get_files();

        var form_html = document.createElement('form');
        form_html.setAttribute("id", "sendAttachmentForm");

        var form_in_div = document.createElement('div');
        $(form_in_div).html('<h6 class="text-muted add-attachment" style="margin-top: 12px; cursor:pointer;">Select Attachments to Send</h6>');
        form_html.append(form_in_div);

        if (files.length) {
            $.each(files, function (i, f) {
                if (!f.file_name) return;
                f.file_url = frappe.urllib.get_full_url(f.file_url);

                $(repl('<p class="checkbox">'
                    + '<label><span><input type="checkbox" data-file-name="%(name)s"></input></span>'
                    + '<span class="small">%(file_name)s</span>'
                    + ' <a href="%(file_url)s" target="_blank" class="text-muted small">'
                    + '<i class="fa fa-share" style="vertical-align: middle; margin-left: 3px;"></i>'
                    + '</label></p>', f))
                    .appendTo(form_in_div)
            });
        }

        console.log(form_html);
        $(form_in_div).append('<button type="submit" class="btn btn-primary btn-sm primary-action" id="sendAttachments" value="Submit">Send Attachments</button>');
        frappe.msgprint(form_html.outerHTML);

        $("#sendAttachmentForm").submit(function (e) {
            e.preventDefault();
            var checkedFiles = [];
            var elements = this.elements;
            for (let i = 0; i < elements.length; i++) {
                if (elements[i].checked) {
                    checkedFiles.push(elements[i].dataset.fileName);
                }
            }

            console.log(checkedFiles);

            frappe.call({
                method: "malco_erpnext.malco_erpnext.malco_erpnext.copy_files_to_icisnet",
                args: {
                    files: checkedFiles,
                    mrn: p.mrn
                },
                freeze: true,
                callback: function (data) {
                    frappe.msgprint("Files staged to copy to ICISnet");
                },
            });
        });
    }
);

frappe.ui.form.on("Project", "proceed_with_icisnet_payment_btn", function (frm, cdt, cdn) {
    var p = cur_frm.doc;

    if (p.proceed_with_icisnet_payment == 1) {
        frappe.msgprint("Project is already in the process of ICISnet Payment.")
    } else {
        if (confirm("Are you sure you want to proceed with ICISnet payment?")) {
            frappe.call({
                method: "malco_erpnext.malco_erpnext.malco_erpnext.create_payment_xml_file",
                args: {
                    projname: p.name
                },
                freeze: true,
                callback: function (data) {
                    frappe.msgprint("Payment XML file has been created.")
                    cur_frm.reload_doc();
                },
            });
        } else {
            // do nothing
        }
    }
});

frappe.ui.form.on("Project", "cancel_proceed_with_icisnet_payment", function (frm, cdt, cdn) {
    var p = cur_frm.doc;

    if (p.proceed_with_icisnet_payment == 1) {
        if (confirm("Are you sure you want to cancel proceed with ICISnet payment?")) {
            frappe.model.set_value(
                p.doctype,
                p.name,
                "proceed_with_icisnet_payment",
                0
            );

            cur_frm.save();
        } else {
            // do nothing
        }
    } else {
        frappe.msgprint("Project is not in the process of ICISnet Payment.")
    }

});

frappe.ui.form.on("Project", "before_save", function (frm, cdt, cdn) {

    if (frm.doc.invoice_analysis) {
        let count = 0;
        for (var e = 0; e < frm.doc.invoice_analysis.length; e++) {
            if (
                frm.doc.invoice_analysis[e].billing_account == "Παροχή Υπηρεσιών - Customs clearance fees"
            ) {
                count++;
            }
        }

        if (count > 1) {
            frappe.msgprint("<h2 style='color: red;'>There are more than one 'Παροχή Υπηρεσιών - Customs clearance fees' added to the invoice analysis table. Please go back and correct it. <h2>")
            throw new Error("unable to save");
        }
    }
    console.log("reaching herer...");
});

frappe.ui.form.on("Project", "eta_or_etd", function (frm, cdt, cdn) {
    var p = cur_frm.doc;
    if(p.days_of_free_demurrage_ && p.eta_or_etd) {
        let days = parseInt(p.days_of_free_demurrage_);
        if (isNaN(days)) days = 0;
        frappe.model.set_value(
                p.doctype,
                p.name,
                "last_day_of_free_demurrage",
                frappe.datetime.add_days(p.eta_or_etd, days)
            );
    }
});

frappe.ui.form.on("Project", "days_of_free_demurrage_", function (frm, cdt, cdn) {
    var p = cur_frm.doc;
    if(p.days_of_free_demurrage_ && p.eta_or_etd) {
        let days = parseInt(p.days_of_free_demurrage_);
        if (isNaN(days)) days = 0;
        frappe.model.set_value(
                p.doctype,
                p.name,
                "last_day_of_free_demurrage",
                frappe.datetime.add_days(p.eta_or_etd, days)
            );
    }
});
