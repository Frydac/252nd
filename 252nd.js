//This is my first Javascript project ever, so I'm learning on the go
//I put a lot of comments everywhere, mainly so hopefully I can understand it later myself

//-----JSLINT
/*jslint browser: true*/
/*global $, jQuery, console*/


//----- TODO:testing 
//-- organize code better, use .then .when functions to deal with async ajax:
//http://jqfundamentals.com/chapter/ajax-deferreds
//http://stackoverflow.com/questions/14465177/multiple-ajax-calls-wait-for-last-one-to-load-then-execute#
//-- make input for outfit name 
//-- make input for minimum played time/month
//-- make input for nr of months
//-- make search while you type for outfit name
//-- implement stable sort: http://www.sitepoint.com/sophisticated-sorting-in-javascript/
//   this is probably easiest: https://github.com/justinforce/merge-sort

//----- ideas
//-- its possible to get which items a player has by using:
//  http://census.soe.com/get/ps2:v2/character/?name.first_lower=dryver&c:resolve=item_full

//----- usefull links:
//soe rest api information (incomplete and faulty information there :s )
//http://census.soe.com/
//
//test your rest queries here
//http://www.planetside-universe.com/api/census.php

//----- Font info
var FONT_ARROW_SMALL_TO_BIG = ' &#x25b2 ';
var FONT_ARROW_BIG_TO_SMALL = ' &#x25BC ';

//for testing purposes
//frydac char id: "5428010618030935617"

//debug variable, set higher than 0 when needed
//this will cause the app to only query max_members_debug amount of members
//and not every member of the outfit.
var MAX_MEMBERS_debug = -1;

//how many members in one REST request
var n_members_per_request = 20;

//global variable of type Outfit, will be initialized later
var outfit = null;

//temp global
var OUTFIT_NAME = "252nd Spec Ops";
//if you want to check other outfits edit this variable, for example uncomment following line
//outfit_name = "INI Elite";

//class/struct declaration for outfit information
function Outfit() {
    this.name = "";
    this.alias = "";
    this.time_created_date = "";
    this.member_count = "";

    //new ones
    //resolve leader_name
    this.leader_name = "";

    //array of Outfit_members with good information
    this.members = [];

    //array of Outfit_members where the SOE API doesn't provide detailed information
    this.members_broken_info = [];
}

//dont know if its ok that this is in the function, in eloquent js its outside, should move to different file and move outside maybe
Outfit.prototype.find_member = function (name) {
    var result = this.members.filter(function (member) {
        return member.name === name;
    });
    //I know for sure that the name is unique so the array returned by the filter function has only 1 member
    return result[0];
};

Outfit.prototype.find_member_by_id = function (id) {
    var result = this.members.filter(function (member) {
        return member.character_id === id;
    });

    return result[0]
}

//increment_decrement should be "increment" or "decrement"
//array_nr should be undefined if not used
Outfit.prototype.sort_members = function (increment_decrement, field, array_nr) {

    var inverse = 0;
    if (increment_decrement === 'increment') {
        inverse = 1;
    } else if (increment_decrement === 'decrement') {
        inverse = -1;
    }
    var comparator = function (member1, member2) {
        var member1_field;
        var member2_field;
        if (array_nr !== undefined) {
            member1_field = member1[field][array_nr];
            member2_field = member2[field][array_nr];
        } else {
            member1_field = member1[field];
            member2_field = member2[field];
        }

        //make sure we are comparing numbers when we have to
        if (field === 'battle_rank' ||
            field === 'rank_ordinal' ||
            field === 'minutes_played' ||
            field === 'playtime_per_month') {
            member1_field = parseInt(member1_field, 10);
            member2_field = parseInt(member2_field, 10);
        }
        if (member1_field < member2_field)
            return (-1 * inverse);
        if (member1_field > member2_field)
            return (1 * inverse);
        return 0;
    };
    this.members.sort(comparator);
};

//this gets some default values to start with
Outfit.prototype.members_sorted_by = function () {
    this.field = '';
    this.array_nr = 0;
    this.increment_decrement = '';
};

//this sort will depend on how the members where sorted, and will update that info
Outfit.prototype.sort_members_with_context = function (field, array_nr) {
    //if it was sorted by the same field, inverse the order
    if (this.members_sorted_by.field === field && this.members_sorted_by.array_nr == array_nr) {
        if (this.members_sorted_by.increment_decrement === "increment")
            this.members_sorted_by.increment_decrement = "decrement";
        else if (this.members_sorted_by.increment_decrement === "decrement")
            this.members_sorted_by.increment_decrement = "increment";
    } else {
        this.members_sorted_by.field = field;
        this.members_sorted_by.array_nr = array_nr;
    }

    //only set this initially, else leave it as is
    if (this.members_sorted_by.increment_decrement === undefined) {
        this.members_sorted_by.increment_decrement = "increment";
    }

    this.sort_members(this.members_sorted_by.increment_decrement, this.members_sorted_by.field, this.members_sorted_by.array_nr);
};

//class/struct declaration for each outfit member
function Outfit_member() {
    this.name = "";
    this.character_id = 0;
    this.battle_rank = 0;
    this.rank_ordinal = 0;
    this.rank = "";
    this.member_since_date = "";
    this.creation_date = "";
    this.last_login_date = "";
    this.last_save_date = "";

    //new ones
    this.minutes_played = 0;

    //the same numbering as SOE will be used:
    //playtime_per_month[0] will be this month, playtime_per_month[1] will be the previous month and so on
    this.playtime_per_month = [];

    //playtime in seconds
    //playtime_per_day[0] is yesterday, playtime_per_day[1] the day before yesterday and so on
    this.playtime_per_day = [];
}

//because the ajax call is asynchronous we have to wait until all queries are done, 
//I do it by adding to this counter when a member is updated, we know how many members there are.
var member_playtimeinfo_done_counter = 0;

//entry point: start doing things when document is ready
//$(document).ready(function () {
    


//    //this needs a better name :D
//    initialize_document(OUTFIT_NAME);
//});


function initialize_document(outfit_name) {
    //get outfit information including memberlist, put outfit in one object, members in another
    //inform user we are waiting for response:
    $("#outfit").html("Waiting for outfit information..");

    var members_stat_history_REST_responses;
    //this is an async function, so it will return before the ajax response (jqXHR) is ready
    var outfitinfo_memberlist_REST_response = get_api_info_outfit(outfit_name);
    //use as jquery deffered/promise object to control codeflow, the first function (only in this case)
    //will be called when the ajax call returns success. See links on top for more information on .then()
    outfitinfo_memberlist_REST_response.then(function (jqXHR_data) {

        //first extract the outfit information and display on the webpage
        outfit = extract_outfit_information(jqXHR_data);
        var outfit_HTML = create_outfit_HTML(outfit);
        $("#outfit").html(outfit_HTML);

        //now extract the members list from the same jqXHR_data put them in the outfit object
        //and make new ajax calls to get the stat history for each
        extract_member_list_information(jqXHR_data, outfit.members, outfit.members_broken_info);
        //        console.log(outfit);
        //this will call a bunch of async functions and returns an array of jqXHR
        //it will also extract the members stat histories, because else we loop too much through the members (may change this later for readability)
        members_stat_history_REST_responses = get_api_info_members_stat_history(outfit.members);

        //again the jquery .next function. Here you see that the abstraction is better protected, else I would have
        //needed to jump out of this function and broken the flow of this function's abstraction.
        $.when.apply(this, members_stat_history_REST_responses).done(function () {
            //when we get here it means that all ajax requests in members_stat_history_REST_responses are done
            outfit.sort_members_with_context("playtime_per_month", 1);
            add_members_to_page(outfit.members);
            create_broken_members_HTML(outfit.members_broken_info);
        });
    });
}

//need an object to record the sorted state, or use stable sort algorithm
//this function sorts by using the embedded attributes in the table header
//it is supposed to be called from a click on a particular tableheader tabledata tag.
function sort_members_by_table_header() {
    var field = $(this).attr('field');
    var array_nr = $(this).attr('array_nr');

    outfit.sort_members_with_context(field, array_nr);

    //recreate html table with newly sorted members
    add_members_to_page(outfit.members);
}

// makes the outfit ajax call and returns the jQuery XML HTTP Request object
function get_api_info_outfit(outfit_name) {
    var outfitinfo_memberlist_REST_URL = "http://census.soe.com/json/s:252nd/get/ps2:v2/outfit/?name="
        + outfit_name
        + "&c:resolve=leader_name, member_character";

    //assign ajax request to variable, its async: the code will go on after this call though we didn't get a response yet
    var outfitinfo_memberlist_REST_response = $.ajax({
        url: outfitinfo_memberlist_REST_URL,
        dataType: "jsonp"
    });
    return outfitinfo_memberlist_REST_response;
}

//extracts outfit information and returns an Outfit object
function extract_outfit_information(ajaxResponse) {
    //should do type/defined checking or something..
    //console.log(ajaxResponse);
    var outfit = new Outfit();
    outfit.name = ajaxResponse.outfit_list[0].name;
    outfit.alias = ajaxResponse.outfit_list[0].alias;
    outfit.time_created_date = ajaxResponse.outfit_list[0].time_created_date;
    outfit.member_count = ajaxResponse.outfit_list[0].member_count;
    outfit.leader_name = ajaxResponse.outfit_list[0].leader.name.first;
    return outfit;
}

function get_api_info_members_stat_history(members) {
    var responses = [];

    var step_size = n_members_per_request;

    //initialize counter on the webpage
    update_get_stat_history_counter(step_size, members);

    for (var member_index = 0; member_index < members.length; member_index += step_size) {
        var response = get_api_info_n_members_stat_history(members, member_index, step_size);
        responses.push(response);
    }
    //console.log(members);
    return responses;
}

function get_api_info_n_members_stat_history(members, index, n) {
    var n_member_char_ids = "";
    for (var i = index; i < index + n && i < members.length; i++) {
        n_member_char_ids += members[i].character_id + ",";
    }

    var stat_history_for_char_REST_URL = "http://census.soe.com/s:252nd/get/ps2:v2/character/?character_id="
    + n_member_char_ids
    + "&c:resolve=stat_history";

    //console.log(stat_history_for_char_REST_URL);

    var response = $.ajax({
        url: stat_history_for_char_REST_URL,
        dataType: "jsonp",
        success: function (response, text_status, jqXHR) {
            //console.log(response);

            //we asked for n chars, so loop through the response character list
            for (var char_list_index in response.character_list) {
                //var current_members_index = index + parseInt(char_list_index);
                var current_member = outfit.find_member_by_id(response.character_list[char_list_index].character_id)
                if (current_member.character_id !== response.character_list[char_list_index].character_id) {
                    console.log("characters returned arent in the same order as in the query! (or my code is bugged ;) )");
                }
                var member_stat_history = response.character_list[char_list_index].stats.stat_history;
                //get the right stat history array index
                for (var mem_stat_index in member_stat_history) {
                    if (member_stat_history[mem_stat_index].stat_name === "time") {
                        //add all the months, its a list of fields/properties, not an array
                        for (var month_field in member_stat_history[mem_stat_index].month) {
                            if (member_stat_history[mem_stat_index].month.hasOwnProperty(month_field)) {
                                current_member.playtime_per_month.push(member_stat_history[mem_stat_index].month[month_field]);
                            }
                        }
                        //add all the days
                        for (var day_field in member_stat_history[mem_stat_index].day) {
                            if (member_stat_history[mem_stat_index].day.hasOwnProperty(day_field)) {
                                current_member.playtime_per_day.push(member_stat_history[mem_stat_index].day[day_field]);
                            }
                        }
                    }
                }
            }

            //update counter in webpage to inform user
            update_get_stat_history_counter(n, members);
        }
    });

    return response;
}

//extracts member information and puts in the array members if they are ok, and in the array members_broken_info if they ar not ok
function extract_member_list_information(ajaxResponse, members, members_broken_info) {
    //member info to extract:
    //character_id, name, battle_rank, rank_ordinal + rank, member_since_date, times.creation_date, times.last_login_date, times.last_save_date

    //for debuggins purposes DEBUG:
    var max_members;
    if (MAX_MEMBERS_debug <= 0)
        max_members = ajaxResponse.outfit_list[0].members.length;
    else
        max_members = MAX_MEMBERS_debug;

    //loop through all the members in the response and extract appropriate information
    for (var member_index = 0; member_index < max_members; member_index++) {
        //use this var to make the dereferencing little less verbose
        var response_member = ajaxResponse.outfit_list[0].members[member_index];
        var member = new Outfit_member();

        //for some reason the member information in the ajax response is not always defined!!
        if (response_member.name !== undefined) {

            //for debug reasons
            //if (response_member.name.first_lower != 'frydac')
            //    continue

            member.character_id = response_member.character_id;
            member.name = response_member.name.first;
            member.battle_rank = response_member.battle_rank.value;
            member.rank_ordinal = response_member.rank_ordinal;
            member.rank = response_member.rank;
            member.member_since_date = response_member.member_since_date;
            member.creation_date = response_member.times.creation_date;
            member.last_login_date = response_member.times.last_login_date;
            member.last_save_date = response_member.times.last_save_date;
            member.minutes_played = response_member.times.minutes_played;

            //add to the members array for future referencing.
            members.push(member);
        }
        else {
            //this member's info is broken, add what the server does return in a separate array
            // character_id, member_since_date, rank, rank_ordinal
            member.character_id = response_member.character_id;
            member.rank_ordinal = response_member.rank_ordinal;
            member.rank = response_member.rank;
            member.member_since_date = response_member.member_since_date;

            //add to the array of members with broken info for future referencing
            members_broken_info.push(member);
        }
    }
}

//returns a string with HTML representing a table using the outfit information
function create_outfit_HTML(outfit) {
    var outfit_HTML = "";
    outfit_HTML = "<h2>" + outfit.name + "</h2>"
        + "<table>"
        + "<tr><td> Name </td> <td>" + outfit.name + "</td></tr>"
        + "<tr><td> Alias </td> <td>" + outfit.alias + "</td></tr>"
        + "<tr><td> Leader </td> <td>" + outfit.leader_name + "</td></tr>"
        + "<tr><td> Date Created </td> <td>" + outfit.time_created_date + "</td></tr>"
        + "<tr><td> Member Count </td> <td>" + outfit.member_count + "</td></tr>"
        + "</table>";
    return outfit_HTML;
}

function add_members_to_page(members) {
    var members_HTML = create_members_HTML(members);
    $("#members").html(members_HTML);
    //rebind functions to new html table elements
    $("table.members th").on("click", sort_members_by_table_header);
    $(".show_extra").on("click", show_member_extra_info);
}

//creates a table with the members info and outputs it to the webpage
function create_members_HTML(members) {

    var current_month = (new Date()).getMonth();
    var minimum_playtime_per_month_in_s = 72000;

    var membersHTML = '<h2>Members</h2>';
    //start table with class alternate_color
    membersHTML += '<table class="members">';
    //  membersHTML += "<thead>";
    //create a table row (tr) with table headers (th)
    membersHTML += '  <tr>'
        + '<th>#</th>'
        + '<th field="name">Name' + add_tableheader_arrow('name', undefined) + '</th>'
        + '<th field="rank_ordinal">Rank' + add_tableheader_arrow('rank_ordinal', undefined) + '</th>'
        + '<th field="battle_rank">BR' + add_tableheader_arrow('battle_rank', undefined) + '</th>'
        + '<th field="member_since_date">Member since' + add_tableheader_arrow('member_since_date', undefined) + '</th>'
        + '<th field="minutes_played">Total' + add_tableheader_arrow('minutes_played', undefined) + '</th>';
    //get the number of months from one member and make the tableheaders with appropriate month names
    for (var month_index in members[0].playtime_per_month) {
        membersHTML += '<th field="playtime_per_month" array_nr="' + month_index + '">';
        var month_name = get_month_name((current_month + 12 - month_index) % 12);
        membersHTML += month_name;
        membersHTML += add_tableheader_arrow('playtime_per_month', month_index);
        membersHTML += '</th>';
    }

    membersHTML += "</tr>  ";
    //  membersHTML += "</thead>";
    //  membersHTML += "<tbody>";
    //loop through members with good info and create html table rows (tr) and table data (td)
    var member;
    var member_counter = 1;
    for (var member_index in members) {
        member = members[member_index];
        var even_row = (member_counter % 2 === 0) ? 'class="even_row"' : "";
        membersHTML += "<tr " + even_row + " >"
            + "<td class=\"right_align\">" + member_counter + "</td>"
            + "<td>"
                + '<button name="' + member.name + '" ' + ' class="show_extra">+</button>'
                + dasanfall_href(member.name)
            + "</td>"
            + "<td>" + member.rank + "</td>"
            + "<td>" + member.battle_rank + "</td>"
            + "<td>" + strip_hour_from_SOE_date(member.member_since_date) + "</td>"
            + "<td>" + transform_m_to_hm(member.minutes_played) + "</td>";
        // + "<td>" + member.last_save_date + "</td>"
        //add each month, could later make this variable
        for (month_index in member.playtime_per_month) {
            var playtime = member.playtime_per_month[month_index];
            membersHTML += "<td " + create_month_tabledata_html_class(playtime, minimum_playtime_per_month_in_s) + ">"
                        + transform_s_to_hms(playtime)
                        + "</td>";
        }
        membersHTML += "</tr>";
        member_counter += 1;
    }
    //  membersHTML += "</tbody>";

    //end table
    membersHTML += "</table>";

    return membersHTML;
}


function create_broken_members_HTML(members_broken_info) {
    //character_id, member_since_date, rank, rank_ordinal

    if (members_broken_info.length === 0) {
        return "";
    }

    var membersHTML = "<h2>Members with broken API info</h2>";
    membersHTML += '<p>These members with broken API info seem not to be listed in the in-game outfit list. </br>'
    + 'On players.planetside2.com they are listed as unknown, with the comment: "This character has either been deleted from the game or has not yet been saved."</p>';
    //start table
    membersHTML += "<table class=\"alternate_color\">";
    membersHTML += "<tr>"
            + "<th>#</th>"
            + "<th>Character id</th>"
            + "</tr>";

    var member_counter = 1;
    for (var member_index in members_broken_info) {
        membersHTML += "<tr>"
            + "<td>" + member_counter + "</td>"
            + "<td>" + members_broken_info[member_index].character_id + "</td>"
            + "</tr>";
        member_counter += 1;
    }

    //end table
    membersHTML += "</table>";

    $("#broken_members").html(membersHTML);
}

function create_member_extra_HTML(member) {
    var date = new Date();
    var member_HTML = "";


    //extract function create_daily_playtimes(member)
    //todo: colspan magic number should be calculated
    member_HTML += '<tr id="' + member.name + '" ><td class="remove_right_border"></td><td class="remove_left_border" colspan="17">';
    member_HTML += "<h4>" + member.name + "</h4>";
    member_HTML += "<p> Play times of the last 31 days (eg. as far as the soe api provides)</p>";

    //member_HTML += '<table class="extra_info"><tr>';
    //for (var day_index in member.playtime_per_day) {
    //    //we start on yesterday
    //    date.setDate(date.getDate() - 1);
    //    var playtime = member.playtime_per_day[day_index];
    //    member_HTML += '<pre><td class="right_align">'
    //                //+ 'day ' + day_index + "\n "
    //                + date.toDateString().slice(0, -5) + "\n "
    //                + transform_s_to_hms(playtime)
    //                + '</td></pre>';
    //    if ((parseInt(day_index) + 1) % 16 === 0) {
    //        member_HTML += '</tr><tr>';
    //    }
    //}
    //member_HTML += '</tr></table>';
    //anchor for chart
    member_HTML += '<div id="' + member.name + '_playtimes_chart" ><p>-- Placeholder for playtimes chart -- (loading)</p></div>';
    //member_HTML += '<div id="test" ></div>';

    // member_HTML += '<p>Some more stats, the api returned them, so why not ;)</p>';
    member_HTML += '<p></p>';
    member_HTML += '<table>';
    member_HTML += '<tr><td>Creation Date</td><td>' + member.creation_date + '</td></tr>';
    member_HTML += '<tr><td>Last Save Date</td><td>' + member.last_save_date + '</td></tr>';
    member_HTML += '<tr><td>Last Login Date</td><td>' + member.last_login_date + '</td></tr>';

    //member_HTML += '<tr><td>Total Play Time</td><td>' + transform_m_to_hm(member.minutes_played) + '</td></tr>';
    //member_HTML += '<tr><td></td><td></td></tr>';
    member_HTML += '</table>';

    //add some space, should probably use css for this
    member_HTML += '<p></p>';

    var start_date = create_date_object(member.creation_date);
    var end_date = new Date(); //now
    var average_playtime = average_playtime_per_day(start_date, end_date, member.minutes_played);
    average_playtime = transform_s_to_hms(average_playtime * 60);
    member_HTML += '<table>';
    member_HTML += '<tr><td>Average Daily Playtime Since Creation Date</td><td>' + average_playtime + '</td></tr>';
    member_HTML += '</table>';
    member_HTML += '<p></p>';


    //close surrounding tabledata field
    member_HTML += '</td></tr>';
    return member_HTML;
}

function average_playtime_per_day(start_date, end_date, time_played) {
    var elapsed_time_in_ms = Math.abs(end_date - start_date);
    //var elapsed_time_in_ms = end_date - start_date;
    var elapsed_time_in_days = elapsed_time_in_ms / 1000 / 60 / 60 / 24;
    // when 0 it could be the same day, so take one day.
    elapsed_time_in_days = elapsed_time_in_days === 0 ? 1 : elapsed_time_in_days;
    return time_played / elapsed_time_in_days;
}

function create_date_object(ingame_date) {
    //javascript date contructor
    //var in_game_date_example = "2012-11-20 18:44:32.0";
    date = new Date();
    date.setFullYear(ingame_date.substring(4, 0));
    date.setMonth(ingame_date.substring(5, 7) - 1);
    date.setDate(ingame_date.substring(8, 10));
    date.setHours(ingame_date.substring(11, 13));
    date.setMinutes(ingame_date.substring(14, 16));
    date.setSeconds(ingame_date.substring(17, 19));
    return date;
}

function show_member_extra_info() {
    var member_name = $(this).attr('name');
    var member = outfit.find_member(member_name);
    var member_extra_HTML = create_member_extra_HTML(member);

    var table_row = $(this).parent().parent();  //tr containing the button
    table_row.after(member_extra_HTML);//.done(function () {
    $(this).html("-");
    $(this).unbind();
    $(this).on("click", hide_member_extra_info);

    var member_playtimes_chart_id = member.name + "_playtimes_chart";
    //this makes the previous html render before the graph is rendered
    //for a more responsive experience
    window.setTimeout(function() {
        return create_member_playtime_bar_chart(member, member_playtimes_chart_id);
    }, 100);

}

function hide_member_extra_info() {
    //this function is bound to a button with the same name as the id of the tr we need to remove
    var id_name = '#' + $(this).attr("name");
    $(id_name).remove();
    $(this).html("+");
    $(this).unbind();
    $(this).on("click", show_member_extra_info);
}

function dasanfall_href(name) {
    //<a href="http://stats.dasanfall.com/ps2/player/Frydac">Frydac</a>
    var html_href = '<a href="http://stats.dasanfall.com/ps2/player/'
            + name
            + '"  target="_blank">'
            + name
            + "</a>";
    return html_href;
}

//create table for broken members and outputs it to the webpage
//transform value in seconds to a formated string and return that
function transform_s_to_hms(time_in_s) {
    var time_in_min = Math.floor(time_in_s / 60);
    var remainder_in_s = time_in_s % 60;
    var time_in_hours = Math.floor(time_in_min / 60);
    var remainder_in_min = time_in_min % 60;

    //do some extra formatting
    if (remainder_in_min < 10)
        remainder_in_min = "0" + remainder_in_min;
    remainder_in_s = Math.round(remainder_in_s * 100) / 100
    if (remainder_in_s < 10)
        remainder_in_s = "0" + remainder_in_s;
    var time_formated = "";
    time_formated += time_in_hours + "h "
                    + remainder_in_min + "m "
                    + remainder_in_s + "s";
    return time_formated;
}

function transform_m_to_hm(time_in_m) {
    var time_in_hours = Math.floor(time_in_m / 60);
    var remainder_in_min = time_in_m % 60;
    if (remainder_in_min < 10)
        remainder_in_min = "0" + remainder_in_min;
    var time_formated = time_in_hours + "h "
                   + remainder_in_min + "m ";
    return time_formated;
}

function get_month_name(month_number) {
    var month = new Array();
    month[0] = "January";
    month[1] = "February";
    month[2] = "March";
    month[3] = "April";
    month[4] = "May";
    month[5] = "June";
    month[6] = "July";
    month[7] = "August";
    month[8] = "September";
    month[9] = "October";
    month[10] = "November";
    month[11] = "December";
    return month[month_number];
}

function create_month_tabledata_html_class(month_play_time, min_time_per_month_in_s) {
    var month_class = "class=\"right_align";
    if (parseInt(month_play_time) < min_time_per_month_in_s)
        month_class += " red";
    month_class += "\"";

    return month_class;
}

//update counter, put on webpage: inform user about the progress
function update_get_stat_history_counter(stepsize, members) {
    var next_upper_bound = parseInt(member_playtimeinfo_done_counter) + parseInt(stepsize);
    var upper_bound = next_upper_bound < members.length ? next_upper_bound : members.length;
    $("#members").html("</br></br> Waiting for respons for members [" + member_playtimeinfo_done_counter + " - " + upper_bound + "]");
    member_playtimeinfo_done_counter += stepsize;
}


function strip_hour_from_SOE_date(SOE_date) {
    return SOE_date.slice(0, -11);
}

function add_tableheader_arrow(field, array_nr) {
    if (field === outfit.members_sorted_by.field &&
        array_nr == outfit.members_sorted_by.array_nr) {
        if (outfit.members_sorted_by.increment_decrement === 'increment')
            return FONT_ARROW_SMALL_TO_BIG;
        else if (outfit.members_sorted_by.increment_decrement === 'decrement')
            return FONT_ARROW_BIG_TO_SMALL;
    } else {
        return '';
    }
}