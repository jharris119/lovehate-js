/* global _, Raphael, colors: true */
/* exported lovehate */

function lovehate(canvas, opts) {
    'use strict';

    var paper = Raphael(canvas, 550, 300);  // jshint ignore:line
    var x, y, person;

    var height = paper.height,
        width  = paper.width;

    var delay = Math.floor(1000 / 16);  

    opts = _.extend({
        count:  5,
        radius: 10,
    }, opts || {});

    colors = _.shuffle(colors);

    Person.id = 1;

    // initialize all the people
    var people = [];
    while (people.length < opts.count) {
        x = _.random(opts.radius, width - opts.radius);
        y = _.random(opts.radius, height - opts.radius);

        if (_.any(people, _.partial(collides, {'x': x, 'y': y, 'radius': opts.radius}))) {
            continue;
        }

        person = new Person(x, y, opts.radius/* , vector */);
        people.push(person);
    }
    if (opts.global) {
        window.people = people;
    }

    var startAll = _.after(people.length, function() {
        console.log('startAll actually started');
        _.each(people, next);
    });
    // once they're initialized, assign each one a random person to love and hate
    _.each(people, function(person) {
        var tmp;
        
        while ((tmp = _.sample(people)) === person) {}
        person.attracted(tmp);

        while ((tmp = _.sample(people)) === person || tmp === person.attracted()) {}
        person.repelled(tmp);

        person.drawn = new SVGGroup(person);
        startAll();
    });

    /**
     * Do two people-like interface things occupy the same space?
     *
     * @param {{x: number, y: number, radius: number}} p - a person-like interface thing
     * @param {{x: number, y: number, radius: number}} q - another person-like thing
     * @return {boolean} - true if p and q occupy the same space, falsy otherwise or if p == q
     */
    function collides(p, q) {
        return p === q ? null : Math.hypot(p.x - q.x, p.y - q.y) <= p.radius + q.radius;
    }

    function doMove(person) {
        var s = Math.polar2rect.apply(null, person.vector);
        person.x += s[0];
        person.y += s[1];

        // if we hit the left wall, and the person's vector points to the left, adjust it to be straight up or down
        if (person.x - person.radius < 0 && Math.abs(person.vector[1]) > Math.PI / 2) {
            person.vector[1] = Math.sign(person.vector[1]) * Math.PI / 2;
        }

        // if we hit the right wall, same deal
        if (person.x + person.radius > paper.width && Math.abs(person.vector[1] < Math.PI / 2)) {
            person.vector[1] = Math.sign(person.vector[1]) * Math.PI / 2;
        } 

        // top wall
        if (person.y - person.radius < 0 && person.vector[1] < 0) {
            person.vector[1] = (person.vector[1] >= -Math.PI / 2 ? 0 : -Math.PI);
        }

        if (person.y + person.radius > paper.height && person.vector[1] > 0) {
            person.vector[1] = (person.vector[1] >= Math.PI / 2 ? 0 : Math.PI);
        }

        person.draw();
    }

    function next(p) {
        var other;

        p.setVector();

        // if we're running into someone, we need to change direction
        if ((other = _.find(people, _.partial(collides, p))) !== undefined) {
            $('button#pauseplay').click();   
            return;       
        }

        doMove(p);
        if (!opts.step) {
            p.timerId = _.delay(next, delay, p);
        }
    }

    function pause(p) {
        if (arguments.length === 0) {
            for (var i = people.length - 1; i >= 0; --i) {
                pause(people[i]);
            }
        }
        else if (p.timerId) {
            clearTimeout(p.timerId);
            p.timerId = null;
        }
    }

    function vectorToEndPoint(origin, vector) {
        var x = origin[0], y = origin[1], r = vector[0], theta = vector[1];
        return [x + (r * Math.cos(theta)), y + (r * Math.sin(theta))];
    }

    function antiparallel(angle, isDegrees) {
        var m = isDegrees ? 180 : Math.PI;
        return angle <= 0 ? angle + m : angle - m;
    }

    function normalizeAngle(angle, isDegrees) {
        var m = isDegrees ? 180 : Math.PI;
        while (angle > m) {
            angle -= m;
        }
        while (angle < m) {
            angle += m;
        }
        return angle;
    }

    /**
     * Represents a Person in this game.
     *
     * @constructor
     * @param {number} x - The initial x-coordinate
     * @param {number} y - The initial y-coordinate
     * @param {number} [radius=10] - The person's radius
     * @param {number} [speed=1.0] - The person's speed
     */
    function Person(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius  = radius;
        this.vector  = [speed || 1.0, null];

        /** @type {!SVGGroup} */
        this.drawn   = null;
        /** @type {?number} */
        this.timerId = null;
        /** @const {number} */
        this.id      = Person.id++;

        /** @const {Person} */
        var attractedTo  = null,
            repelledFrom = null;

        /** @const Person[] */
        var pointedAtBy  = []; 

        /**
         * Get or set who this person loves.
         *
         * When called with a parameter, this method is a setter. When called 
         * without a parameter, this method is a getter.
         *
         * @param {Person} [attractor] - the person that this person loves
         * @return {Person} - the person that this person loves
         */
        this.attracted = function(attractor) {
            if (attractor && attractor.constructor === Person) {
                attractedTo = attractor;
                attractor.getPointedAtBy().push(this);
            }
            return attractedTo; 
        };

        this.isAttractedTo = function(person) {
            return attractedTo === person;
        };

        /**
         * Get or set who this person hates.
         *
         * When called with a parameter, this method is a setter. When called
         * without a parameter, this method is a getter.
         *
         * @param {Person} [attractor] - the person that this person hates
         * @return {Person} - the person that this person hates
         */
        this.repelled  = function(repellant) {
            if (repellant && repellant.constructor === Person) {
                repelledFrom = repellant;
                repellant.getPointedAtBy().push(this);
            }
            return repelledFrom;
        };

        this.isRepelledFrom = function(person) {
            return repelledFrom === person;
        };

        /**
         * Calculate and set the direction this person should move considering
         * the locations of their loves and hates.
         */
        this.setVector = function() {
            var lovedir = Math.atan2(attractedTo.y - this.y, attractedTo.x - this.x),
                hatedir = Math.atan2(repelledFrom.y - this.y, repelledFrom.x - this.x);

            this.vector[1] = normalizeAngle(lovedir + antiparallel(hatedir));
        };

        /**
         * Draw the SVG elements associated with this person.
         */
        this.draw = function() {
            if (!this.drawn) {
                this.drawn = new SVGGroup(this);
            }
            else {
                this.drawn.moveSVGElements();
            }   
        };

        this.getPointedAtBy = function() { 
            return pointedAtBy;
        };

        this.getElement = function() {
            return this.drawn.circle;
        };

        this.highlight = function() {
            var ep = vectorToEndPoint([this.x, this.y], [75, this.vector[1]]);
            this.drawn.glow = this.drawn.circle.glow();
            this.drawn.glow.push(paper.path(
                Raphael.format('M{0},{1}L{2},{3}', this.x, this.y, ep[0], ep[1])).attr({
                    'stroke-width': 5,
                    'arrow-end': 'classic-wide-long'
                }));
        };

        this.unhighlight = function() {
            if (this.drawn.glow && this.drawn.glow.forEach) {
                this.drawn.glow.forEach(function(el) {
                    el.remove();
                });
                delete this.drawn.glow;                
            }
        };
    }

    /**
     * The collection of SVGElements tied to this Person.
     *
     * @constructor
     */
    function SVGGroup(person) {
        var pt, pathstr;
        this.circle = paper.circle(person.x, person.y, person.radius - 2).attr({
            'fill': colors.shift(),
            'stroke-width': 1
        });

        console.assert(person.attracted());
        pt = Math.circleClosest(person, person.attracted());
        pathstr = Raphael.format('M{0},{1}L{2},{3}', person.x, person.y, pt[0], pt[1]);
        this.lovearrow = paper.path(pathstr).attr({
            'stroke': 'pink',
            'stroke-dasharray': '- ',
            'stroke-width': 2,
            'arrow-end': 'classic-wide-long'
        });
    
        console.assert(person.repelled());
        pt = Math.circleClosest(person, person.repelled());
        pathstr = Raphael.format('M{0},{1}L{2},{3}', person.x, person.y, pt[0], pt[1]);
        this.hatearrow = paper.path(pathstr).attr({
            'stroke': 'black',
            'stroke-dasharray': '. ',
            'stroke-width': 2,
            'arrow-end': 'classic-wide-long'
        });
 
        /**
         * Called when the person is moved.
         */
        this.moveSVGElements = function() {
            var incoming;

            // move the person
            this.circle.attr({
                'cx': person.x,
                'cy': person.y
            });

            // move the love and hate arrows that start at the person
            moveLine(this.lovearrow, { 'start': [person.x, person.y] });
            moveLine(this.hatearrow, { 'start': [person.x, person.y] });

            // move the arrows that terminate at the person
            incoming = person.getPointedAtBy();
            _.each(incoming, function(i) {
                var arrow;
                if (i.isAttractedTo(person)) {
                    arrow = i.drawn.lovearrow;
                }
                else if (i.isRepelledFrom(person)) {
                    arrow = i.drawn.hatearrow;
                }
                else {
                    console.assert(false, 'incoming arrow must come from a lover or a hater');
                }

                moveLine(arrow, { 'end': Math.circleClosest(i, person)});
            });
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

    return {
        people: people,
        pause: pause,
        next: next,
    };
}

if (Math.sign === undefined) {
    Math.sign = function sign(x) {
        'use strict';
        x = +x; // convert to a number
        if (x === 0 || isNaN(x)) {
            return x;
        }
        return x > 0 ? 1 : -1;
    };    
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

    console.debug('Start at (%d,%d) and find the closest point on circle centered at (%d,%d)', p.x, p.y, circle.x, circle.y);

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