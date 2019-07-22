$(document).ready(function() {
    console.log("Ready");
    //console.log({{ docs|len }});

    $.when(
        $.getScript("/assets/frappe/js/lib/slickgrid/jquery.event.drag.js"),
        $.getScript("/assets/frappe/js/lib/slickgrid/slick.core.js"),
        $.getScript("/assets/frappe/js/lib/slickgrid/slick.grid.js"),
        $.getScript("js/require.js"),
        $.getScript("js/underscore.js"),
        $.getScript("js/jquery.slickgrid.export.excel.js"),
        $.Deferred(function(deferred) {
            $(deferred.resolve);
        })
    ).done(function() {

        requirejs.config({
            baseUrl: 'js' //give the location of the folder which contains require, excel-builder, etc
        });

        function formatter(row, cell, value, columnDef, dataContext) {
            return value;
        }

        function dateFormatterr(row, cell, value, columnDef, dataContext) {
            var dd = value.getDate() < 10 ? "0" + value.getDate() : value.getDate();
            var mm = value.getMonth() < 10 ? "0" + value.getMonth() : value.getMonth();
            return dd + '-' + mm + '-' + value.getFullYear();
        }

        function dateFormatter(row, cell, value, columnDef, dataContext) {
            var fdate = value.split("-");
            return fdate[2] + '/' + fdate[1] + '/' + fdate[0];
        }

        var grid;
        var columns = [{
                id: "project_name",
                name: "Project Name",
                width: 120,
                field: "project_name",
                formatter: formatter
            },
            {
                id: "customs_document_type",
                name: "Customs Document Type",
                width: 120,
                field: "customs_document_type"
            },
            {
                id: "status",
                name: "Status",
                field: "status",
                width: 120
            },
            {
                id: "eta_or_etd",
                name: "ETA or ETD",
                field: "eta_or_etd",
                width: 120,
                formatter: dateFormatter
            },
            {
                id: "date_of_final_delivery_or_dispatch",
                name: "Date of Final Delivery or Dispatch",
                field: "date_of_final_delivery_or_dispatch",
                width: 120,
                formatter: dateFormatter
            },
            {
                id: "house_master",
                name: "House Master",
                field: "house_master",
                width: 120
            },
            {
                id: "country_of_import_or_export",
                name: "Country of Import or Export",
                field: "country_of_import_or_export",
                width: 120
            },
            {
                id: "country_of_final_destination",
                name: "Country of Final Destination",
                field: "country_of_final_destination",
                width: 120
            },
            {
                id: "master_bol_or_cmr",
                name: "Master BOL or CMR",
                field: "master_bol_or_cmr",
                width: 120
            },
            {
                id: "container_number",
                name: "Container Number",
                field: "container_number",
                width: 120
            },
            {
                id: "lot",
                name: "Lot",
                field: "lot",
                width: 120
            },
            {
                id: "external_means_of_transport",
                name: "External Means of Transport",
                field: "external_means_of_transport",
                width: 120
            }
        ];
        var options = {
            enableCellNavigation: true,
            enableColumnReorder: false,
            explicitInitialization: true
        };
        frappe.freeze();
        $.ajax({
            method: "GET",
            url: "/",
            dataType: "json",
            data: {
                cmd: "malco_erpnext.templates.pages.projs.get_projects"
            },
            success: function(res) {
                //console.log(res);
                //default excel options
                var excelOptions = {
                    headerStyle: {
                        font: {
                            bold: true, //enable bold
                            font: 12, // font size
                            color: '00ffffff' //font color --Note: Add 00 before the color code
                        },
                        fill: { //fill background
                            type: 'pattern',
                            patternType: 'solid',
                            fgColor: '00428BCA' //background color --Note: Add 00 before the color code
                        }
                    },
                    cellStyle: {
                        font: {
                            bold: false, //enable bold
                            font: 12, // font size
                            color: '00000000' //font color --Note: Add 00 before the color code
                        },
                        fill: { //fill background
                            type: 'pattern',
                            patternType: 'solid',
                            fgColor: '00ffffff' //background color --Note: Add 00 before the color code
                        }
                    },
                };
                var excelData = [];

                $(function() {
                    var data = [];
                    var grid_data = [];

                    if (res.message) {
                        for (var e = 0; e < res.message.length; e++) {
                            var container_number = res.message[e].container_number || "";
                            var lot_number = res.message[e].lot_number || "";

                            //  if(res.message[e].container_data){
                            //  	if(res.message[e].container_data.length > 0){
                            //  		container_number = res.message[e].container_data[0].container_number;
                            //  		lot_number = res.message[e].container_data[0].lot_number;
                            //  	}
                            // }

                            data.push({
                                project_name: "<a href='/projects?project=" + res.message[e].project_name + "'>" + res.message[e].project_name + "</a>",
                                customs_document_type: res.message[e].customs_document_type,
                                status: res.message[e].status,
                                eta_or_etd: res.message[e].eta_or_etd,
                                date_of_final_delivery_or_dispatch: res.message[e].date_of_final_delivery_or_dispatch,
                                house_master: res.message[e].house_master,
                                country_of_import_or_export: res.message[e].country_of_import_or_export,
                                country_of_final_destination: res.message[e].country_of_final_destination,
                                master_bol_or_cmr: res.message[e].master_bol_or_cmr,
                                container_number: res.message[e].container_number,
                                lot: res.message[e].lot_number,
                                external_means_of_transport: res.message[e].external_means_of_transport
                            });

                            grid_data.push({
                                project_name: res.message[e].project_name,
                                customs_document_type: res.message[e].customs_document_type,
                                status: res.message[e].status,
                                eta_or_etd: res.message[e].eta_or_etd,
                                date_of_final_delivery_or_dispatch: res.message[e].date_of_final_delivery_or_dispatch,
                                house_master: res.message[e].house_master,
                                country_of_import_or_export: res.message[e].country_of_import_or_export,
                                country_of_final_destination: res.message[e].country_of_final_destination,
                                container_number: res.message[e].container_number,
                                lot: res.message[e].lot_number,
                                master_bol_or_cmr: res.message[e].master_bol_or_cmr,
                                external_means_of_transport: res.message[e].external_means_of_transport
                            });
                        }
                    }

                    var width = $("#gridParent").width();
                    var height = $("#gridParent").height();
                    //var height = 500;
                    //console.log(width);
                    //console.log(height);

                    if (data.length > 0) {
                        var myGrid = $("<div id='myGrid' style='width:" + width + "px;height:" + height + "px;'></div>");
                        myGrid.appendTo($("#gridParent"));
                        grid = new Slick.Grid(myGrid, data, columns, options);
                        grid.init();
                        //grid.setSortColumn("date_of_final_delivery_or_dispatch",true);
                        //grid.setData(grid.getData());
                        //grid.setColumns(grid.getColumns());
                        //grid.autosizeColumns();

                        // after this line call the export to excel plugin
                        $('body').exportToExcel("Report.xlsx", "Report", grid_data, excelOptions, function(response) {
                            //console.log(response);
                        });
                        frappe.unfreeze();
                    } else {
                        frappe.msgprint("No projects found.");
                    }
                })
            }
        });
    });

    $(document).on('click', '#refresh', function(){
        location.reload();
    });
});