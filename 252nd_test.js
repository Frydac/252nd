//help intellisense
/// <reference path="252nd.js" />

test("a basic test example", function () {
    var value = "hello";
    equal(value, "hello", "We expect value to be hello");
});

test("create js date object from ingame date string", function () {
    var in_game_date_example = "2012-11-20 18:44:32.0";

    var date_object = new Date();

    date_object = create_date_object(in_game_date_example);

    equal(date_object.getFullYear(), 2012, "test");
    equal(date_object.getMonth(), 11 - 1, "month in range 0-11");
    equal(date_object.getDate(), 20, "day in month");
    equal(date_object.getHours(), 18, "hours");
    equal(date_object.getMinutes(), 44, "minutes");
    equal(date_object.getSeconds(), 32, "seconds");
 
});

test("average playtime", function () {
    var start_date = new Date(2014, 7, 1);
    var end_date = new Date(2014, 7, 1);
    var playtime = 10;

    var average_play_time = 0;

    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    
    equal(average_play_time, 10, "playtime of 1 day");

    var end_date = new Date(2014, 7, 3);
    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 5, "playtime of 2 days");

    var end_date = new Date(2014, 8, 1);
    playtime = (31) * 5;
    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 5, "playtime of 30 days");

    var end_date = new Date(2015, 7, 1);
    playtime = (365) * 5;
    average_play_time = average_playtime_per_day(start_date, end_date, playtime);
    equal(average_play_time, 5, "playtime of 365 days");


});