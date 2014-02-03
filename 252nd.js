//This is my first Javascript project ever, so I'm learning on the go
//I put a lot of comments everywhere, mainly so hopefully I can understand it later myself



//----- TODO:
//-- organize code better, use .then .when functions to deal with async ajax:
//http://jqfundamentals.com/chapter/ajax-deferreds
//http://stackoverflow.com/questions/14465177/multiple-ajax-calls-wait-for-last-one-to-load-then-execute#
//-- make input for outfit name 
//-- make input for minimum played time/month
//-- make input for nr of months
//-- make search while you type for outfit name
//--

//----- usefull links:
//soe rest api information (incomplete and faulty information there :s )
//http://census.soe.com/
//
//test your rest queries here
//http://www.planetside-universe.com/api/census.php

//for testing purposes
//frydac char id: "5428010618030935617"

//debug variable, set higher than 0 when needed
//this will cause the app to only query max_members_debug amount of members
//and not every member of the outfit.
var max_members_debug = -1;

//global variable of type Outfit, will be initialized later
var outfit = null;

//class/struct declaration for outfit information
function Outfit() {
    this.name = "";
    this.alias = "";
    this.time_created_date = "";
    this.member_count = "";

    //array of Outfit_members with good information
    this.members = [];

    //array of Outfit_members where the SOE API doesn't provide detailed information
    this.members_broken_info = [];

    //dont know if its ok that this is in the function, in eloquent js its outside, should move to different file and move outside maybe
    Outfit.prototype.find_member = function (name) {
        var result = this.members.filter(function (member) {
            return member.name === name;
        });
        //console.log(result);
        //I know for sure that the name is unique
        return result[0];
    };

    //TODO: 
    //this.leader = new Outfit_member;
    //this.prototype.sort_members
    //this.prototype.find_member
}


//class/struct declaration for each outfit member
function Outfit_member() {
    this.name = "";
    this.character_id = "";
    this.battle_rank = "";
    this.rank_ordinal = "";
    this.rank = "";
    this.member_since_date = "";
    this.creation_date = "";
    this.last_login_date = "";
    this.last_save_date = "";

    //the same numbering as SOE will be used:
    //month[0] will be this month, month[1] will be the previous month and so on
    this.playtime_per_month = [];
}

//because the ajax call is asynchronous we have to wait until all queries are done, I do it by adding to this counter when a member is updated, we know how many members there are.
var member_playtimeinfo_done_counter = 0;

//entry point: start doing things when document is ready
$(document).ready(function () {
     var outfit_name = "252nd Spec Ops";
    //if you want to check other outfits edit this variable, for example uncomment following line
    //outfit_name = "INI Elite";

    //this needs a better name :D
    initialize_document(outfit_name);

});


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
        console.log(outfit);
        //this will call a bunch of async functions and returns an array of jqXHR
        //it will also extract the members stat histories, because else we loop too much through the members (may change this later for readability)
        members_stat_history_REST_responses = get_api_info_members_stat_history(outfit.members);

        //again the jquery .next function. Here you see that the abstraction is better protected, else I would have
        //needed to jump out of this function and broken the flow of this function's abstraction.
        $.when.apply(this, members_stat_history_REST_responses).done(function () {
            //when we get here it means that all ajax requests in members_stat_history_REST_responses are done
            //extract_members_stat_history(arguments);
            //need to rewrite this
            outfit.members.sort(function (m1, m2) {
                return parseInt(m1.playtime_per_month[1]) - parseInt(m2.playtime_per_month[1]);
            });
            var members_HTML = create_members_HTML(outfit.members);
            $("#members").html(members_HTML);

            $(".show_extra").bind("click", show_member_extra_info);
            create_broken_members_HTML(outfit.members_broken_info);

        });
    });


}

// makes the outfit ajax call and returns the jQuery XML HTTP Request object
function get_api_info_outfit(outfit_name) {
    var outfitinfo_memberlist_REST_URL = "http://census.soe.com/json/s:252nd/get/ps2:v2/outfit/?name="
        + outfit_name
        + "&c:resolve=member_character(name,battle_rank,rank_ordinal,rank,member_since_date,times.creation_date,times.last_login_date,times.last_save_date)";

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
    var outfit = new Outfit();
    outfit.name = ajaxResponse.outfit_list[0].name;
    outfit.alias = ajaxResponse.outfit_list[0].alias;
    outfit.time_created_date = ajaxResponse.outfit_list[0].time_created_date;
    outfit.member_count = ajaxResponse.outfit_list[0].member_count;
    return outfit;
}


//-- TODO make fewer api calls, one way is to put more member char_ids in the query
function get_api_info_members_stat_history(members) {
    var responses = [];

    var step_size = 10;

    //initialize counter
    update_get_stat_history_counter(step_size, members);



    for (member_index = 0; member_index < members.length; member_index += step_size) {
        var response = get_api_info_n_members_stat_history(members, member_index, step_size);
        responses.push(response);
    }



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
            for (char_list_index in response.character_list) {
                var current_members_index = index + parseInt(char_list_index);
                var current_member = members[current_members_index];
                if (current_member.character_id !== response.character_list[char_list_index].character_id) {
                    console.log("characters returned arent in the same order as in the query! (or my code is bugged ;) )")
                }
                var member_stat_history = response.character_list[char_list_index].stats.stat_history;
                //get the right stat history array index
                for (mem_stat_index in member_stat_history) {
                    if (member_stat_history[mem_stat_index].stat_name === "time") {
                        //add all the months, its a list of fields/properties, not an array
                        for (month_field in member_stat_history[mem_stat_index].month) {
                            if (member_stat_history[mem_stat_index].month.hasOwnProperty(month_field)) {
                                current_member.playtime_per_month.push(member_stat_history[mem_stat_index].month[month_field]);
                            }
                        };
                    }
                }

            }

            //update counter in webpage to inform user
            update_get_stat_history_counter(n, members)



            //console.log(members);
        }
    });

    return response;


}
//
function get_api_info_member_stat_history(member) {
    var member_char_id = member.character_id;
    var stat_history_for_char_REST_URL = "http://census.soe.com/s:252nd/get/ps2:v2/character/?character_id="
        + member_char_id
        + "&c:resolve=stat_history";
    var response = $.ajax({
        url: stat_history_for_char_REST_URL,
        dataType: "jsonp",
        success: function (response, text_status, jqXHR) {
            //member_stat_history is an array of stats, they have a stat name of which the index seems different for different characters
            var member_stat_history = response.character_list[0].stats.stat_history;
            //get the right stat history array index
            for (index in member_stat_history) {
                if (member_stat_history[index].stat_name === "time") {
                    //add all the months, its a list of fields/properties, not an array
                    for (month_field in member_stat_history[index].month) {
                        if (member_stat_history[index].month.hasOwnProperty(month_field)) {
                            member.playtime_per_month.push(member_stat_history[index].month[month_field]);
                        }
                    };

                }
            }
            //this one is done, augment done counter
            member_playtimeinfo_done_counter += 1;
            //update counter in webpage to inform user
            $("#members").html("</br></br> Waiting for respons for member " + member_playtimeinfo_done_counter);
        }
    });
    return response;
}

//extracts member information and puts in the array members if they are ok, and in the array members_broken_info if they ar not ok
function extract_member_list_information(ajaxResponse, members, members_broken_info) {
    //member info to extract:
    //character_id, name, battle_rank, rank_ordinal + rank, member_since_date, times.creation_date, times.last_login_date, times.last_save_date

    //loop through all the members in the response and extract appropriate information
    //for (member_index in ajaxResponse.outfit_list[0].members) {
    //DEBUG:

    var max_members;
    if (max_members_debug <= 0)
        max_members = ajaxResponse.outfit_list[0].members.length;
    else
        max_members = max_members_debug;

    for (member_index = 0; member_index < max_members; member_index++) {

        //use this var to make the dereferencing little less verbose
        var response_member = ajaxResponse.outfit_list[0].members[member_index];

        var member = new Outfit_member();

        //for some reason the member information in the ajax response is not always defined!!
        if (response_member.name !== undefined) {
            member.character_id = response_member.character_id;
            member.name = response_member.name.first;
            member.battle_rank = response_member.battle_rank.value;
            member.rank_ordinal = response_member.rank_ordinal;
            member.rank = response_member.rank;
            member.member_since_date = response_member.member_since_date;
            member.creation_date = response_member.times.creation_date;
            member.last_login_date = response_member.times.last_login_date;
            member.last_save_date = response_member.times.last_save_date;

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
        + "<tr><td> Date Created </td> <td>" + outfit.time_created_date + "</td></tr>"
        + "<tr><td> Member Count </td> <td>" + outfit.member_count + "</td></tr>"
        + "</table>";
    return outfit_HTML;
}

//creates a table with the members info and outputs it to the webpage
function create_members_HTML(members) {

    //sort_members();

    //current date to produce month names
    var d = new Date();

    var membersHTML = "<h2>Members</h2>";
    //start table with class alternate_color
    membersHTML += "<table class=\"alternate_color\" >";
    //  membersHTML += "<thead>";
    //create a table row (tr) with table headers (th)
    membersHTML += "<tr>"
        + "<th>#</th>"
        + "<th>Name</th>"
        + "<th>Rank</th>"
        + "<th>BR</th>"
        + "<th>Member since</th>";
    //get the number of months from one member and make the tableheaders with appropriate month names
    //console.log(members[0].playtime_per_month);
    for (month_index in members[0].playtime_per_month) {
        membersHTML += "<th>"
            + get_month_name((d.getMonth() + 12 - month_index) % 12)
            + "</th>";
    }

    membersHTML += "</tr>";
    //  membersHTML += "</thead>";
    //  membersHTML += "<tbody>";
    //loop through members with good info and create html table rows (tr) and table data (td)
    var member;
    var member_counter = 1;
    for (member_index in members) {
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
        // + "<td>" + member.last_save_date + "</td>"
        //add each month, could later make this variable
        for (month_index in member.playtime_per_month) {
            var playtime = member.playtime_per_month[month_index];
            membersHTML += "<td " + create_class(playtime) + ">"
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


function create_member_extra_HTML(member) {
    console.log(member);
    console.log(member.name);
    var member_HTML = "";
    member_HTML += '<tr id="' + member.name + '" ><td class="remove_right_border"></td><td class="remove_left_border" colspan="16">';
    member_HTML += "<h4>"+ member.name + "</h4>";
    member_HTML += '<table><tr><td>test</td><td>test</td></tr></table>';
    member_HTML += '</td></tr>';
    return member_HTML;
}

function show_member_extra_info() {
    var par = $(this).parent().parent();  //tr containing the button
    var member_name = par.children().eq(1).children().eq(1).text();
    var member = outfit.find_member(member_name);
    var member_extra_HTML = create_member_extra_HTML(member);
    par.after(member_extra_HTML);
    $(this).html("-");
    $(this).unbind();
    $(this).bind("click", hide_member_extra_info);
}

function hide_member_extra_info() {
    console.log("hide_month");

    //this function is bound to a button with the same name as the id of the tr we need to remove
    var id_name = '#' + $(this).attr("name");
    $(id_name).remove();
    $(this).html("+");
    $(this).unbind();
    $(this).bind("click", show_member_extra_info);
}

function dasanfall_href(name) {
    //<a href="http://stats.dasanfall.com/ps2/player/Frydac">Frydac</a>
    var html_href = "<a href=\"http://stats.dasanfall.com/ps2/player/"
            + name
            + "\"  target=\"_blank\">"
            + name
            + "</a>";
    return html_href;

}

//create table for broken members and outputs it to the webpage
function create_broken_members_HTML(members_broken_info) {

    //character_id, member_since_date, rank, rank_ordinal

    var membersHTML = "<h2>Members with broken API info</h2>";
    //start table
    membersHTML += "<table class=\"alternate_color\">";
    membersHTML += "<tr>"
            + "<th>#</th>"
            + "<th>Character id</th>"
            + "</tr>";



    var member_counter = 1;
    for (member_index in members_broken_info) {
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

//transform value in seconds to a formated string and return that
function transform_s_to_hms(time_in_s) {
    var time_in_min = Math.floor(time_in_s / 60);
    var remainder_in_s = time_in_s % 60;
    var time_in_hours = Math.floor(time_in_min / 60);
    var remainder_in_min = time_in_min % 60;

    //do some extra formatting
    if (remainder_in_min < 10)
        remainder_in_min = "0" + remainder_in_min;
    if (remainder_in_s < 10)
        remainder_in_s = "0" + remainder_in_s;
    var time_formated = "";
    time_formated += time_in_hours + "h "
                    + remainder_in_min + "m "
                    + remainder_in_s + "s";
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

function create_class(month_play_time) {
    var month_class = "class=\"right_align";
    var min_time_per_month_in_s = 72000;
    if (parseInt(month_play_time) < min_time_per_month_in_s)
        month_class += " red";
    month_class += "\"";

    return month_class;
}

//update counter, put on webpage: inform user about the progress
function update_get_stat_history_counter(stepsize, members) {
    var possible_upper_bound = parseInt(member_playtimeinfo_done_counter) + parseInt(stepsize);
    var upper_bound = possible_upper_bound < members.length ? possible_upper_bound : members.length;
    $("#members").html("</br></br> Waiting for respons for members [" + member_playtimeinfo_done_counter + " - " + upper_bound + "]")
    member_playtimeinfo_done_counter += stepsize;
}


function sort_members(members, field) {
    function compare_m(member1, member2) {
        if (parseInt(member1.field) < parseInt(member2.field))
            return -1;
        if (parseInt(member1.field) > parseInt(member2.field))
            return 1;
        return 0;
    }
    members.sort(compare_month01);
}

function strip_hour_from_SOE_date(SOE_date) {
    return SOE_date.slice(0, -11);

}