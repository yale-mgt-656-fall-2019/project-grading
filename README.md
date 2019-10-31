# Project grading

This is the grading code for the project. When you run the
code, it will show you what tests you're passing, what
you're "failing", and how to pass the test if you're "failing".

## Running the testing code

You can run the testing code online at
[https://grading.656.mba](https://grading.656.mba).
Most people will want to run the grading code online.
When you run the grading code online give it 1) your
class number (656 or 660); 2) your team nickname; and 3)
the URL where your app is running. (Of course, if you
run the grading code online your app will need to be online
as well---you can't test localhost from grading.656.mba.)

You can also run this code locally on your computer
if you have Docker and bash installed on your system.
If you do, you can run the testing code with something
like

```
./admin.sh run 656 foo-bar 'http://host.docker.internal:8080'
```

That assumes you're running your project (app) code on
localhost 8080.

Note that you will need to run 

```
./admin.sh build
```

before running this code for the first time (and every time 
the grading code changes).

## Caveats

- This code will likely change. When it changes I will
  increment the version number and post to Piazza to
  alert you.
- The code takes a while to run (up to a minute) because
  it uses a version of Chrome to run the tests.
- Test often!

## Overview

When you run the testing code and pass all the tests,
it will look something like this, but your URLs will
be different than mine. (Yours will likely be on Heroku.)

```
When I visit the homepage at http://host.docker.internal:8080
✅ - it is "up"
     I get a "200 OK" HTTP response. This basically just means that your
     website is up.

✅ - it has a title
     I test for a non-zero length string in the <title></title> tags of the
     page. Your title is "My eventbrite clone"

✅ - it has valid HTML
     I run your homepage through https://validator.w3.org/nu to check it
     for errors.

✅ - it uses a popular CSS framework
     I'm looking for "bootstrap", "bulma", "material", "foundation", or
     "semantic" in the href attribute of a <link> element in the <head> of
     your document. You should be using one of those CSS frameworks to make
     your pages look rad. Google it.

✅ - it has links to all your events
     That is, your homepage should list all the events people can attend. I
     check for 4 <a> elements with href attributes containing '/events/0',
     '/events/1', '/events/2', and'/events/4'. Of course, you might have
     other events. The CSS selector for these is something like
     'a[href*="/events/0"]'.

✅ - it each event has a time associated with it
     I'm testing for the existence of three or more <time> tags on the
     page.

✅ - it has a link to your about page in the footer
     I'm testing for an <a> element with "/about" in its href attribute
     inside of a <footer> element on your page.

✅ - it has a link to your home page in the footer
     I'm testing for an <a> element with "/" alone in its href attribute
     inside of a <footer> element on your page.

✅ - it has a logo
     I'm testing for an <img> tag with id="logo" inside a <header> element
     on your page.

✅ - it has a link to create a new event
     I'm testing for an <a> tag with an href containing "/events/new"


When I visit the about page at http://host.docker.internal:8080/about
✅ - it exists
     I get a "200 OK" HTTP response.

✅ - it contains your team nickname
     The nickname is the team nickname you find in the dashboard on the
     class website. You indicated that your team nickname is "foo-bar" and
     I expect to see that text somewhere on your about page.


When I visit an event detail page at /events/4 (randomly chosen)
✅ - it exists
     I get a "200 OK" HTTP response.

✅ - it has a link to your about page in the footer
     I'm testing for an <a> element with "/about" in its href attribute
     inside of a <footer> element on your page.

✅ - it has a link to your home page in the footer
     I'm testing for an <a> element with "/" alone in its href attribute
     inside of a <footer> element on your page.

✅ - it has an h1 element with the event title
     I'm testing for an <a> element with "/" alone in its href attribute
     inside of a <footer> element on your page.

✅ - it has no errors shown on the page
     When I first load the page, there should be no errors, clearly. I'm
     checking for elements with one of the following classes- error,
     errors, form-error, form-errors.

✅ - it has a link to donate to the event
     This is how users would donate in order to support the event. I'm
     checking for an <a> with href containing /events/4/donate

✅ - it shows the people who have RSVP'd for the event
     The page should show these email addresses of those attending. You
     should be showing at least these people homer.simpson@yale.edu.

✅ - it has a form for RSVP'ing to the event
     I test for a form with action="POST" on the page.

✅ - it has an RSVP form has an input for the user's email address
     I test for a an input with type="email" and name="email" inside a form
     element.

✅ - it has a submit button
     I test for a an input with type="submit" inside a form element. You
     can also use a button with type="submit".

✅ - it should allow jocbaw@yale.edu to RSVP
     I fill out the email input and submit the form. After the form is
     submitted I check the page for the presence of the email address and
     confirmation code. The email address and confirmation code for which I
     checked this time are jocbaw@yale.edu and 3d22ffb, which is the first
     seven characters of the sha256 hash of jocbaw@yale.edu.

✅ - it should not allow ude@zuzpe.sc to RSVP
     I fill out the email input and submit the form. After the form is
     submitted I check the page for the presence of the email address among
     those attending. It should not be there. Note that I am turning off
     client-side form validation so that you'll have to handle validation
     on the server! I also check for an element with class="errors". This
     should be there and it should show the user a message like "only
     Yalies!", though, the particular message doesn't matter.


When I visit your API at /api/events
✅ - it exists
     I get a HTTP 200 OK response.

✅ - it is valid JSON format
     I try to parse your response assuming it is valid JSON. Errors make
     the test fail.

✅ - it has all the default events
     Your JSON should be formatted such that it has a key "events" that
     stores an array of events. E.g. it should looks something like this
     https://bit.ly/2J5IA2g I'm checking for events with ids 0, 1, 2, and
     4. .


When I visit your API for a specific event at /api/events/4
✅ - it exists
     I get a HTTP 200 OK response.

✅ - it is valid JSON format
     I try to parse your response assuming it is valid JSON. Errors make
     the test fail.

✅ - it has the right event information
     I should find that it has the right title information. The title
     should be "Cooking lessons for the busy business student".


When I visit page for creating a new event at /events/new
✅ - it exists
     I get a HTTP 200 OK response.

✅ - it has a form for submitting a new event
     I test for a form element on the page

✅ - it does not have an errors shown on the page by default
     When a user creates an event with invalid data, an error message
     should be shown to them. There should be no error message on the page
     otherwise. I'm checking for elements with one of the following
     classes- error, errors, form-error, form-errors.

✅ - it the form has inputs for title, location, image URL, date and a submit button

     These should all be on the page.
     I test for the following CSS selectors
     * form input[type="text"][name="title"]
     * form input[type="text"][name="location"]
     * form input[type="url"][name="image"]
     * form input[type="datetime-local"][name="date"]
     * form input[type="submit"], form button[type="submit"]
     .


✅ - it does not allow creating an event with bad title
     Titles must be more than 5 and fewer than 50 unicode characters. If
     the title is invalid, you should return the user to the form (at the
     same URL) and show them their error. I'm checking for elements with
     one of the following classes- error, errors, form-error, form-errors.
     The invalid title I submitted was "Dutres nago kucaltaf pihcu su
     kecogin keipreh mesfonnet en nimhun ezze juhindup emhapel zep meriuse
     ga risano femuz ne ridna abausar pofeh hukfalot poc.".

✅ - it does not allow creating an event with bad location
     Location must be more than 5 and fewer than 50 unicode characters. If
     the location is invalid, you should return the user to the form (at
     the same URL) and show them their error. I'm checking for elements
     with one of the following classes- error, errors, form-error,
     form-errors. The invalid location I submitted was "Loviv hozonag sikew
     rafbig gucal cu uwu wuecure dirriwlih vew majag daaj pihi tipuduji
     abokur to gibjugguc pici ekoagu ohadezon kiklehev to gucaiti vor.".

✅ - it does not allow creating an event with bad image
     Images should be a valid URL and be one of the following file types-
     ".png", ".jpg", ".jpeg", ".gif", or ".gifv". If the image is invalid,
     you should return the user to the form (at the same URL) and show them
     their error. I'm checking for elements with one of the following
     classes- error, errors, form-error, form-errors. The invalid location
     I submitted was "Thomas Steffen's private island".

✅ - it does not allow creating an event with bad date
     Dates must be be in the format "2006-01-02T15:04" and also be in the
     future. If the date is invalid, you should return the user to the form
     (at the same URL) and show them their error. The bad I'm checking for
     elements with one of the following classes- error, errors, form-error,
     form-errors. The invalid date I submitted was "2018-09-09T18:01".

✅ - it allows creating a valid event
     If I submit valid event information, you should create the new event
     and then redirect me to the event detail page at "/events/ID" where
     "ID" is the id of the new event. There should be no errors on the
     page. I'm checking for elements with one of the following classes-
     error, errors, form-error, form-errors. The valid event I submitted
     was "80s dance party" at "Sharon Oster's Manhattan penthouse" on
     "2019-11-26T23:39" with image "https://i.imgur.com/71297O5.gifv".
```
