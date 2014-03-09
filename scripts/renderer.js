//help intellisense
/// <reference path="../252nd.js" />

//not covered by unittests, it draws a google chart to html element with specified id
function create_member_playtime_bar_chart(member,id) {
    var data = google.visualization.arrayToDataTable(google_tabledata_playtimes(member, extract_day(new Date(),1)));
    
    //var dateFormatter = new google.visualization.DateFormat({formatType: 'long'} );
    var format_hour_min_sec = new google.visualization.DateFormat({ pattern: "H'h 'mm'm 'ss's'" });
    var format_hour_min = new google.visualization.DateFormat({ pattern: "H'h 'mm'm '" });
    format_hour_min_sec.format(data, 1);
    format_hour_min.format(data, 2);
    var format_long = new google.visualization.DateFormat({ formatType: 'long' });
    format_long.format(data, 0);

    var options = {
        title: member.name + ', playtimes of the last 31 days',
        vAxis: { title: 'Playtime', format: "H'h'mm" },
        hAxis: { gridlines: { color: '#CC0' }},
        fontSize : 12,
        'height': 300,
        legend: { position: 'none' },
        chartArea: { left: 100 , width: '100%'},
        bar: { groupWidth: '80%' },
        annotations : { textStyle : { fontSize: 11 } }
        //axisTitlesPosition : 'none'
    };

    var chart = new google.visualization.ColumnChart(document.getElementById(id));
    chart.draw(data, options);
}

//returns an array following googles table data format
function google_tabledata_playtimes(member, start_date) {
    var tabledata = [];
    tabledata[0] = ['Day', 'Playtime', { role: 'annotation' }];
    var current_date = start_date;
    for (var day in member.playtime_per_day) {
        tabledata[parseInt(day) + 1] = make_data_row(current_date, member.playtime_per_day[day]);
        current_date = extract_day(current_date, 1);
    }
    return tabledata;
}

// makes an array like:
//["Sat Mar 08 2014",Date,Date]
function make_data_row(date,playtime_in_s) {
    var data_row = [];

    data_row[0] = date.toDateString();

    data_row[1] = new Date(0,0,0);
    data_row[1].setSeconds(playtime_in_s);

    data_row[2] = new Date(0, 0, 0);
    data_row[2].setSeconds(playtime_in_s);
    return data_row;
}

//Extracts number of days from given date, and returns a new date object
function extract_day(date, nr_of_days) {
    var days = new Date(nr_of_days * 1000 * 60 * 60 * 24);
    var date_days_extracted = new Date(date.getTime() - days.getTime());
    return date_days_extracted;
}