frappe.ui.form.on("Sales Invoice", "refresh", function (frm, cdt, cdn) {

    if (frm.doc.__islocal && frm.doc.amended_from) {
        cur_frm.set_value("mydata_evresis_id", "");
        cur_frm.set_value("mydata_infile_created", 0);
        cur_frm.set_value("mydata_official_mark_number", "Awaiting from MyData server");
        cur_frm.set_value("mydata_qr_link", "");
        cur_frm.set_value("mydata_result", "Awaiting from MyData server");
        cur_frm.set_value("mydata_uid_number", "Awaiting from MyData server");
    }

    if (frm.doc.docstatus == 1 && frm.doc.mydata_infile_created) {
        let html_value = '<div><img width="30%" src="files/' + frm.doc.name + '_QR.png"><img></div>';
        $(frm.fields_dict.qr_code.wrapper).html(html_value);
    }

    if (frm.doc.docstatus == 1 && !frm.doc.mydata_qr_link && frappe.datetime.get_day_diff("2024-01-01", frm.doc.posting_date) <= 0) {
        frappe.msgprint('<p style="color:red; font-weight: bold;">QR code under process, please do not send invoice before QR is created.</p>');
        $('.btn-new-email').hide();
        $('.reply-link').hide();
        let x = $('.grey-link');
        for (let index = 0; index < x.length; index++) {
            if (x[index].text == "Email") {
                console.log($(x[index]).hide());
            }
        }
    }
    if (frm.doc.docstatus == 1 && !frm.doc.mydata_infile_created) {
        frm.add_custom_button(__("Create Komvos File"), function () {
            frappe.call({
                "method": "malco_erpnext.malco_erpnext.malco_erpnext.create_file_to_sign_frm_json",
                args: {
                    doc: frm.doc,
                    method: "",
                },
                freeze: true,
                callback: function (data) {
                    frappe.msgprint("File created");
                }
            })
        });
    }
    if (frm.doc.docstatus == 1) {
        frm.add_custom_button(__("Create cXML"), function () {
            frappe.call({
                "method": "malco_erpnext.malco_erpnext.cxml_creator.start_cxml",
                args: {
                    docname: frm.doc.name
                },
                freeze: true,
                callback: function (data) {
                    frappe.msgprint("CXML file created");
                }
            })
        });
    }

    if (frm.doc.mydata_result == "ERROR" && frm.doc.docstatus == 1) {
        frm.add_custom_button(__("Recreate Komvos File"), function () {
            frappe.call({
                "method": "malco_erpnext.malco_erpnext.malco_erpnext.create_file_to_sign_frm_json",
                args: {
                    doc: frm.doc,
                    method: "",
                    recreate: 1
                },
                freeze: true,
                callback: function (data) {
                    frappe.msgprint("File created");
                    cur_frm.set_value("mydata_result", "");
                    cur_frm.save("Update");
                }
            })
        });
    }

    if (frm.doc.customer) {
        frappe.call({
            "method": "frappe.client.get_value",
            args: {
                doctype: "Customer",
                fieldname: "customer_group",
                filters: {
                    name: ["=", frm.doc.customer]
                }
            },

            callback: function (data) {
                if (data.message.customer_group == "Individual") {
                    if (frm.doc.is_return) {
                        cur_frm.set_value("naming_series", "RCPT-RET-");
                    } else {
                        cur_frm.set_value("naming_series", "RCPT-");
                    }
                }
            }
        });
    }

    if (frm.doc.naming_series == "RCPT-" || frm.doc.naming_series == "RCPT-RET-") {
        setPrintPF("MalCo Receipt");
    }

    if (frm.doc.is_return && frm.doc.return_against.includes("SINV-")) {
        cur_frm.set_value("naming_series", "SINV-RET-");
    }

    if (frm.doc.naming_series == "SINV-RET-") {
        setPrintPF("MalCo Invoice Credit Note");
    }
});

function setPrintPF(pf) {
    let element = document.getElementsByClassName("fa-print")[0];
    element.addEventListener('click', function () {
        setTimeout(function () {
            let ele = document.getElementsByClassName("print-preview-select")[0];
            console.log(ele);
            ele.value = pf;
            ele.dispatchEvent(new Event('change'));
        }, 1000);
    }, false);
}

frappe.ui.form.on("Sales Invoice", "after_submit", function (frm, cdt, cdn) {
    var p = frm.doc;
    cur_frm.reload();
    // if(frm.doc.docstatus==1 && !frm.doc.algobox_signature) {
    //     frm.add_custom_button(__("Create Algobox Signature"), function(){
    //         var p = frm.doc;
    //         frappe.call({	
    //             "method": "frappe.client.get_value",
    //             args: {
    //                 doctype: "Customer",
    //                 fieldname: "customer_group",
    //                 filters: {
    //                     name:["=", p.customer]
    //                     }           			
    //                 },	
    //                 freeze: true,
    //                 callback: function (data) {	
    //                 console.log(data.message.customer_group);

    //                 if(data.message.customer_group == "Individual"){	
    //                     frappe.call({
    //                         method: "malco_erpnext.malco_erpnext.malco_erpnext.upload_transaction_ts",
    //                         args:{
    //                             "doctype": "Sales Invoice",
    //                             "docname": p.name,
    //                             "pf": "MalCo Invoice"
    //                         },
    //                         freeze: true,
    //                         callback: function(r) {
    //                             frappe.msgprint("File uploaded for Signature");
    //                             }
    //                         })
    //                 }
    //             }
    //         })
    //     });
    // }

    // if(frm.doc.docstatus==1 && !frm.doc.algobox_signature) {
    //     frm.add_custom_button(__("Fetch Algobox Signature"), function(){
    //         var p = frm.doc;
    //         frappe.call({	
    //             "method": "frappe.client.get_value",
    //             args: {
    //                 doctype: "Customer",
    //                 fieldname: "customer_group",
    //                 filters: {
    //                     name:["=", p.customer]
    //                     }           			
    //                 },	
    //                 freeze: true,
    //                 callback: function (data) {	
    //                 console.log(data.message.customer_group);

    //                 if(data.message.customer_group == "Individual"){	
    //                     frappe.call({
    //                         method: "malco_erpnext.malco_erpnext.malco_erpnext.get_algo_signature",
    //                         args:{
    //                             "doctype": "Sales Invoice",
    //                             "docname": p.name
    //                         },
    //                         freeze: true,
    //                         callback: function(r) {
    //                                 if(r.message == "No signature found or Something went wrong!!!!"){
    //                                     frappe.msgprint("No signature found");
    //                                 }else{
    //                                     console.log(r);
    //                                 }
    //                             }
    //                         })
    //                 }
    //             }
    //         })
    //     });
    // }
});

// frappe.ui.form.on("Sales Invoice", "after_submit", function(frm, cdt, cdn){
// 	var p = frm.doc;
// 	frappe.call({	
// 		"method": "frappe.client.get_value",
// 		args: {
// 			doctype: "Customer",
// 			fieldname: "customer_group",
// 			filters: {
// 				name:["=", p.customer]
// 				}           			
// 			},	

// 			callback: function (data) {	
// 			console.log(data.message.customer_group);

// 			if(data.message.customer_group == "Individual"){	
// 				frappe.call({
// 					method: "malco_erpnext.malco_erpnext.malco_erpnext.upload_transaction_ts",
// 					args:{
// 						"doctype": "Sales Invoice",
// 						"docname": p.name,
// 						"pf": "MalCo Invoice"
// 					},
// 					freeze: true,
// 					callback: function(r) {
// 						frappe.msgprint("File uploaded for Signature");
// 						}
// 					})
// 			}
// 		}
// 	})

// });

frappe.ui.form.on("Sales Invoice", "create_invoice_with_attachments", function (frm, cdt, cdn) {
    var p = frm.doc;
    const w = window.open('/api/method/malco_erpnext.malco_erpnext.malco_erpnext.download_multi_pdf?' +
        'doctype=' + encodeURIComponent(p.doctype) +
        '&name=' + encodeURIComponent(p.name));
    if (!w) {
        frappe.msgprint(__('Please enable pop-ups'));
        return;
    }
});

frappe.ui.form.on("Sales Invoice", "before_submit", function (frm, cdt, cdn) {
    var p = frm.doc;
    if (p.project_grand_total) {
        console.log(parseFloat(p.project_grand_total).toFixed(2));
        console.log(Math.abs(parseFloat(p.grand_total).toFixed(2)));
        if (parseFloat(p.project_grand_total).toFixed(2) != Math.abs(parseFloat(p.grand_total).toFixed(2))) {
            frappe.throw("Project grand total and Invoice grand total mismatched");
        } else {
            console.log("Totals Matched");
        }
    }
});

frappe.ui.form.on("Sales Invoice", "paid_via_journal_entry", function (frm, cdt, cdn) {
    var p = frm.doc;
    if (p.payment_journal_entry && p.payment_journal_entry != "") {
        frappe.call({
            "method": "malco_erpnext.malco_erpnext.malco_erpnext.payment_via_journal_entry",
            args: {
                document_type: "Sales Invoice",
                document_name: p.name,
                journal_entry: p.payment_journal_entry
            },
            freeze: true,
            callback: function (data) {
                frappe.msgprint("Updated");
                location.reload();
            }
        })
    } else {
        frappe.throw("Payment Journal Entry Required to mark this invoice as paid.");
    }
});

frappe.ui.form.on("Sales Invoice", "close_projects", function (frm, cdt, cdn) {
    var p = frm.doc;
    if (p.project_reference_list.length > 0) {
        frappe.call({
            "method": "malco_erpnext.malco_erpnext.malco_erpnext.ci_invoice_after_email_actions",
            args: {
                docname: p.name,
            },
            freeze: true,
            callback: function (data) {
                frappe.msgprint("Project closed.");
            }
        })
    } else {
        frappe.throw("No projects in this combined invoice.");
    }
});
