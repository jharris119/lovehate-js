/* global _, Raphael, Colors */
/* exported lovehate */

function lovehate(canvas, opts) {
    'use strict';
    var paper = Raphael(canvas, 550, 300);  // jshint ignore:line
    var x, y, person;

    var height = paper.height,
        width  = paper.width;

    var delay = Math.floor(1000 / 16); 

    /**
     * @constructor
     */
    function Person(x, y, radius, vector) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vector = vector || [5.0, Raphael.rad(30)];
        this.drawn  = null;

        var attractedTo  = null,
            repelledFrom = null;

        var pointedAtBy  = []; 

        var _this = this;   // closure variable

        /**
         * @constructor
         */
        function SVGGroup() {
            this.circle = paper.circle(_this.x, _this.y, _this.radius).attr({
                'fill': Colors.shift(),
                'stroke-width': 0
            });
            this.lovearrow = attractedTo ? paper.path(Raphael.format('M{0},{1}L{2},{3}', _this.x, _this.y, attractedTo.x, attractedTo.y)).attr({
                'stroke': 'pink',
                'stroke-dasharray': '- ',
                'arrow-end': 'classic-wide-long',
            }) : null;
            this.hatearrow = repelledFrom ? paper.path(Raphael.format('M{0},{1}L{2},{3}', _this.x, _this.y, repelledFrom.x, repelledFrom.y)).attr({
                'stroke': 'black',
                'stroke-dasharray': '. ',
                'arrow-end': 'classic-wide-long',
            }) : null;

            this.onMove = function() {
                this.circle.attr({
                    'cx': _this.x,
                    'cy': _this.y
                });
                moveLine(this.lovearrow, { 'start': [_this.x, _this.y] });
                moveLine(this.hatearrow, { 'start': [_this.x, _this.y] });
                _.each(pointedAtBy, function(person) {
                    var el = person.attracted() === _this ? person.drawn.lovearrow : person.drawn.hatearrow;
                    moveLine(el, { 'end': [_this.x, _this.y] });
                });
            };
        }

        this.attracted = function(arg) {
            if (arg && arg.constructor === Person) {
                attractedTo = arg;
                pointedAtBy.push(arg);
            }
            return attractedTo; 
        };

        this.repelled  = function(arg) {
            if (arg && arg.constructor === Person) {
                pointedAtBy.push(arg);
                repelledFrom = arg;
            }
            return repelledFrom;
        };

        this.draw = function() {
            if (!this.drawn) {
                this.drawn = new SVGGroup();
            }
            else {
                this.drawn.onMove();
            }   
        };

        function moveLine(element, newcoords) {
            var p = element.attr('path'),
                newpath = Raphael.format('M{0},{1}L{2},{3}',
                newcoords.start ? newcoords.start[0] : p[0][1],
                newcoords.start ? newcoords.start[1] : p[0][2],
                newcoords.end   ? newcoords.end[0]   : p[1][1],
                newcoords.end   ? newcoords.end[1]   : p[1][2]);
            element.attr({
                path: newpath
            });
        }
    }
    Person.collides = function(p, q) {
        return Math.hypot(p.x - q.x, p.y - q.y) < p.radius + q.radius;
    };

    opts = _.extend({
        count:  5,
        radius: 10,
    }, opts || {});

    _.shuffle(Colors);

    // initialize all the people
    var people = [];
    while (people.length < opts.count) {
        x = _.random(opts.radius, width - opts.radius);
        y = _.random(opts.radius, height - opts.radius);

        if (_.any(people, _.partial(Person.collides, {'x': x, 'y': y, 'radius': opts.radius}))) {
            continue;
        }

        person = new Person(x, y, opts.radius/* , vector */);
        people.unshift(person);
    }

    // once they're initialized, assign each one a random person to love and hate
    _.each(people, function(person) {
        var tmp;
        while (!(tmp = person.attracted()) || tmp === person) {
            person.attracted(_.sample(people));
        }
        while (!(tmp = person.repelled()) || tmp === person || tmp === person.attracted()) {
            person.repelled(_.sample(people));
        }
        person.draw();
    });

    function doMove(person) {
        var s = Math.polar2rect.apply(null, person.vector);
        person.x += s[0];
        person.y += s[1];

        if (person.x - person.radius < 0 || person.x + person.radius > paper.width) {
            person.vector[1] = Math.PI - person.vector[1];
        }
        if (person.y - person.radius < 0 || person.y + person.radius > paper.height) {
            person.vector[1] *= -1;
        }

        person.draw();
    }

    // function next(person) {
    //     _.delay(function() {
    //         movePerson(person);
    //         next(person);
    //     }, 1000 / 16);
    // }

    $(document).keypress(function(evt) {
        doMove(people[evt.which - 49]);
    });
}

Math.hypot = function(x, y) {
    'use strict';
    return Math.sqrt(x * x + y * y);
};

Math.polar2rect = function(r, theta) {
    'use strict';
    return [r * Math.cos(theta), r * Math.sin(theta)];
};

Math.rect2polar = function(x, y) {
    'use strict';
    return [Math.hypot(x, y), Math.atan(y / x)];
};