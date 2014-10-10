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
    function Person(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius  = radius;
        this.vector  = [this.speed || 1.0, null];
        this.drawn   = null;
        this.timerId = null;

        var attractedTo  = null,
            repelledFrom = null;

        var pointedAtBy  = []; 

        var _this = this;   // closure variable

        /**
         * @constructor
         */
        function SVGGroup() {
            var pt, pathstr;
            this.circle = paper.circle(_this.x, _this.y, _this.radius - 2).attr({
                'fill': Colors.shift(),
                'stroke-width': 1
            });

            if (attractedTo) {
                pt = Math.circleClosest(_this, attractedTo);
                pathstr = Raphael.format('M{0},{1}L{2},{3}', _this.x, _this.y, pt[0], pt[1]);
                this.lovearrow = paper.path(pathstr).attr({
                    'stroke': 'pink',
                    'stroke-dasharray': '- ',
                    'arrow-end': 'classic-wide-long'
                });
            }
            if (repelledFrom) {
                pt = Math.circleClosest(_this, repelledFrom);
                pathstr = Raphael.format('M{0},{1}L{2},{3}', _this.x, _this.y, pt[0], pt[1]);
                this.hatearrow = paper.path(pathstr).attr({
                    'stroke': 'black',
                    'stroke-dasharray': '. ',
                    'arrow-end': 'classic-wide-long'
                });
            }

            this.onMove = function() {
                this.circle.attr({
                    'cx': _this.x,
                    'cy': _this.y
                });

                moveLine(this.lovearrow, { 'start': [_this.x, _this.y] });
                moveLine(this.hatearrow, { 'start': [_this.x, _this.y] });
                _.each(_this.getPointedAtBy(), function(person) {
                    var el = person.attracted() === _this ? person.drawn.lovearrow : person.drawn.hatearrow;
                    moveLine(el, { 'end': Math.circleClosest(person, _this) });
                });
            };
        }

        this.attracted = function(attractor) {
            if (attractor && attractor.constructor === Person) {
                attractedTo = attractor;
                attractor.addConnection(this);
            }
            return attractedTo; 
        };

        this.repelled  = function(repellant) {
            if (repellant && repellant.constructor === Person) {
                repelledFrom = repellant;
                repellant.addConnection(this);
            }
            return repelledFrom;
        };

        this.setVector = function() {
            this.vector[1] = Math.atan2(attractedTo.y - this.y, attractedTo.x - this.x);
        };

        this.draw = function() {
            if (!this.drawn) {
                this.drawn = new SVGGroup();
            }
            else {
                this.drawn.onMove();
            }   
        };

        this.addConnection = function(connection) {
            pointedAtBy.push(connection);
        };

        this.getPointedAtBy = function() { 
            return pointedAtBy;
        };

        this.getElement = function() {
            return this.drawn.circle;
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
        return p === q ? false : Math.hypot(p.x - q.x, p.y - q.y) < p.radius + q.radius;
    };
    Person.id = 1;

    opts = _.extend({
        count:  5,
        radius: 10,
    }, opts || {});

    Colors = _.shuffle(Colors);

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
        
        while ((tmp = _.sample(people)) === person) {}
        person.attracted(tmp);

        while ((tmp = _.sample(people)) === person || tmp === person.attracted()) {}
        person.repelled(tmp);

        person.draw();
        next(person);
    });

    function doMove(person) {
        var s = Math.polar2rect.apply(null, person.vector), other, ltheta, htheta;
        person.x += s[0];
        person.y += s[1];

        if (person.x - person.radius < 0 || person.x + person.radius > paper.width) {
            person.vector[1] = Math.PI - person.vector[1];
        }
        if (person.y - person.radius < 0 || person.y + person.radius > paper.height) {
            person.vector[1] *= -1;
        }

        // if (other = _.find(people, _.partial(Person.collides, person))) {
        //     // average the love vector and the opposite of the hate vector
        //     ltheta = Raphael.angle(person.x, person.y, person.attracted().x, person.attracted().y);
        //     htheta = Raphael.angle(person.repelled().x, person.repelled().y, person.x, person.y);
        //     if (ltheta + htheta > 0) {
        //         person.vector[1] += (2 * Math.PI / 3600);
        //     }
        //     else {
        //         person.vector[1] -= (2 * Math.PI / 3600);
        //     }
        // }

        person.draw();
    }

    function next(p) {
        var other;

        p.setVector();

        // if we're running into someone, we need to change direction
        if (other = _.find(people, _.partial(Person.collides, person))) {
            void(0);            
        }

        doMove(p);
        if (!opts.step) {
            p.timerId = _.delay(next, delay, p);
        }
    }

    function pause(p) {
        if (arguments.length === 0) {
            _.each(people, pause);
        }
        else if (p.timerId) {
            clearTimeout(p.timerId);
        }
    }

    $(document).keypress(function(evt) {
        if (evt.which === 80 || evt.which === 112) {
            pause();
            return;
        }

        doMove(people[evt.which - 49]);
    });

    return people;
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
    return [Math.hypot(x, y), Math.atan2(y, x)];
};

/**
 * Find the real root(s) of the quadratic equation ax ^ 2 + bx + c = 0.
 *
 * @param Number a
 * @param Number b
 * @param Number c
 * @return an array of real roots of the equation
 */
Math.solveQuadratic = function(a, b, c) {
    'use strict';
    var det = b * b - 4 * a * c, sqrt;
    if (det < 0) {
        return [];
    }
    else if (det === 0) {
        return [-b / 2 / a];
    }
    else {
        sqrt = Math.sqrt(det);
        return [(-b + sqrt) / (2 * a), (-b - sqrt) / (2 * a)];
    }
};

/**
 * Find the point on circle that is closest to p.
 */
Math.circleClosest = function(p, circle) {
    'use strict';
    var x0 = p.x, y0 = p.y;
    var x1 = circle.x, y1 = circle.y, r = circle.radius;

    var roots, d0, d1;

    // find the slope of the line connecting (x0,y0) and (x1,y1)
    var m = (y1 - y0) / (x1 - x0);

    // if the points are on the same vertical line, then return the point on the 
    // circle that's also on that line and above or below the center
    if (isNaN(m)) {
        return p.y > y1 ? [x1, y1 + r] : [x1, y1 - r];
    }

    // frigging math:
    // 
    // the line connecting (x0,y0) and (x1,y1) is: y - y1 = m * (x - x1)
    // the circle centered at (x1,y1) with radius r is: (x - x1) ^ 2 + (y - y1) ^ 2 = r ^ 2
    //
    // solve the top equation for y: y = m * (x - x1) + y1
    // 
    // substitute for y in the bottom equation, also FOIL the first term:
    // (x ^ 2 - 2 * x1 * x + x1 ^ 2) + (m * (x - x1) + y1 - y1) ^ 2 = r ^ 2
    //
    // cancel out y1, square both of the remaining terms:
    // (x ^ 2 - 2 * x1 * x + x1 ^ 2) + m ^ 2 * (x - x1) ^ 2 = r ^ 2
    //
    // FOIL:
    // (x ^ 2 - 2 * x1 * x + x1 ^ 2) + m ^ 2 * (x ^ 2 - 2 * x1 * x + x1 ^ 2) = r ^ 2
    //
    // Distribute m ^ 2 and collect like terms:
    // (m ^ 2 + 1) * x ^ 2 - 2 * x1 * (m ^ 2 + 1) * x + (m ^ 2 + 1) * x1 ^ 2 - r ^ 2 = 0

    roots = Math.solveQuadratic(m * m + 1, -2 * x1 * (m * m + 1), (m * m + 1) * x1 * x1 - r * r);

    // find the coordinates' y-values by plugging them back into the point-slope equation
    roots = _.map(roots, function(x) {
        return [x, m * (x - x1) + y1];
    });

    // and choose the point that's closest. pick the point whose x-coordinate is closer to p.x.
    d0 = Math.abs(p.x - roots[0][0]);
    d1 = Math.abs(p.x - roots[1][0]);
    if (d0 !== d1) {
        return d0 < d1 ? roots[0] : roots[1];
    }
    else {
        return Math.abs(p.y - roots[0][1]) < Math.abs(p.y - roots[1][1]) ? roots[0] : roots[1];
    }
};