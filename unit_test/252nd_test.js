//help intellisense
/// <reference path="../252nd.js" />
/// <reference path="../scripts/renderer.js" />
/// <reference path="http://code.jquery.com/qunit/qunit-1.14.0.js"/>

//test("a basic test example", function () {
//    var value = "hello";
//    window.equal(value, "hello", "We expect value to be hello");
//});

var equal = equal;

module('252nd.js');

test("create_date_object(in_game_date_example)", function () {
    var in_game_date_example = "2012-11-20 18:44:32.0";

    // ReSharper disable once AssignedValueIsNeverUsed
    var date_object = new Date();

    date_object = create_date_object(in_game_date_example);

    equal(date_object.getFullYear(), 2012, "Year");
    equal(date_object.getMonth(), 11 - 1, "month in range 0-11");
    equal(date_object.getDate(), 20, "day in month");
    equal(date_object.getHours(), 18, "hours");
    equal(date_object.getMinutes(), 44, "minutes");
    equal(date_object.getSeconds(), 32, "seconds");
   
 
});

test("average_playtime_per_day(start_date, end_date, playtime)", function () {
    var start_date = new Date(2014, 7, 1);
    var end_date = new Date(2014, 7, 1);
    var playtime = 10;

    // ReSharper disable once AssignedValueIsNeverUsed
    var average_play_time = 0;

    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 10, "playtime of 1 day");

    end_date = new Date(2014, 7, 3);
    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 5, "playtime of 2 days");
   
    end_date = new Date(2014, 8, 1);
    playtime = (31) * 8;
    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 8, "playtime of 31 days");

    end_date = new Date(2015, 7, 1);
    playtime = (365) * 13;
    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 13, "playtime of 365 days");


});


module('renderer.js');

test(' make_data_row(date,playtime_in_s)', function () {

    var date = new Date(2014, 3, 5);
    var date2 = new Date(2014, 3, 5);
    equal(date.toString(), date2.toString(), 'testing js Date object equals');


    var output_array;
    var playtime_date = new Date(2014, 3, 9);
    var playtime_in_s = 10 * 60;

    var playtime_date_object = new Date(0, 0, 0);
    playtime_date_object.setSeconds(playtime_in_s);
    var expected_output = new Array();
    expected_output[0] = playtime_date.toDateString();
    expected_output[1] = playtime_date_object;
    expected_output[2] = playtime_date_object;

    output_array = make_data_row(playtime_date,playtime_in_s);

    deepEqual(output_array, expected_output, "testing 10 min playtime and some date");
});

test("function google_tabledata_playtimes(member,start_date)", function () {
    var member = new Outfit_member();
    member.playtime_per_day[0] = 600;
    var playtime_date = new Date(2014, 3, 9);

    var expected_output = new Array();
    expected_output[0] = ['Day', 'Playtime', { role: 'annotation' }];

    expected_output[1] = make_data_row(playtime_date, 600);
    console.log(expected_output);
    var output = google_tabledata_playtimes(member, playtime_date);
    deepEqual(output, expected_output, "member with one playtime per day");

    member.playtime_per_day[1] = 800;
    var playtime_date_one_less = new Date(2014, 3, 8);
    expected_output[2] = make_data_row(playtime_date_one_less, 800);
    output = google_tabledata_playtimes(member, playtime_date);
    deepEqual(output, expected_output, "member with 2 playtimes per day");
});

