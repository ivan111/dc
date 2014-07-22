/*
 * ve.js
 * Visual Electronic Circuit module
*/

/*jslint           browser : true,   continue : true,
  devel  : true,    indent : 4,       maxerr  : 50,
  newcap : true,     nomen : true,   plusplus : true,
  regexp : true,    sloppy : true,       vars : false,
  white  : true,  bitwise  : true
*/
/*global ec, ve */

var ve = (function ()
{
    var
        BASE_W = 50,
        BASE_H = BASE_W,
        BASE_R = 5,

        PI0_5 = 0.5 * Math.PI,
        PI1_5 = 1.5 * Math.PI,
        PI2 = 2 * Math.PI,

        T_LEFT  = 1,
        T_RIGHT = 2,
        T_UP    = 3,
        T_DOWN  = 4,

        DIST_PIN_TURN = 20,

        ALIGN_MID      = 0,
        ALIGN_PIN      = 1,
        ALIGN_TOP      = 2,
        ALIGN_PIN_TURN = 3,

        DIP_WIDTH = 56,
        DIP_H_UNIT = 25,
        DIP_H_PAD = 4,

        ON_COLOR              = "#CC0052",
        OFF_COLOR             = "#00A3CC",
        RE_ACTIVE_LOW = /_B$/,
        RE_SUBSCRIPT = /_\d$/,

        Path, Connector,
        DummyIN, DummyOUT,
        Inverter, AndGate, OrGate, NandGate, NorGate, XorGate, XnorGate;


    function error ( msg )
    {
        console.log( msg );
        throw msg;
    }



    function bind ( context, name )
    {
        return function () {
            return context[name].apply( context, arguments );
        };
    }



    function isActiveLow( pinName )
    {
        return RE_ACTIVE_LOW.test( pinName );
    }



    function hasSubscript( pinName )
    {
        return RE_SUBSCRIPT.test( pinName );
    }



    function calcLinePtDist( pt1, pt2, pt )
    {
        var d = 9999,
            retPt = { x: 0, y: 0 },
            minV, maxV;

        if ( pt1.x === pt2.x )
        {
            minV = Math.min( pt1.y, pt2.y );
            maxV = Math.max( pt1.y, pt2.y );

            if ( minV - 1 <= pt.y && pt.y <= maxV + 1 )
            {
                d = Math.abs(pt1.x - pt.x);
                retPt = { x: pt1.x, y: pt.y };
            }
        }
        else if ( pt1.y === pt2.y )
        {
            minV = Math.min( pt1.x, pt2.x );
            maxV = Math.max( pt1.x, pt2.x );

            if ( minV - 1 <= pt.x && pt.x <= maxV + 1 )
            {
                d = Math.abs(pt1.y - pt.y);
                retPt = { x: pt.x, y: pt1.y };
            }
        }
        else
        {
            error( 'calcDist error' );
        }

        return { dist: d, pt: retPt };
    }



    function calcPtPtDist( pt1, pt2 )
    {
        var xd, yd;

        xd = pt2.x - pt1.x;
        yd = pt2.y - pt1.y;

        return Math.sqrt( xd * xd   +   yd * yd );
    }



    function getSignalColor ( s )
    {
        if ( s === 1 ) {
            return ON_COLOR;
        }

        return OFF_COLOR;
    }



    function LEFT( x, y ) {
        return { x: x, y: y, direction: T_LEFT };
    }

    function RIGHT( x, y ) {
        return { x: x, y: y, direction: T_RIGHT };
    }

    /*
    function UP( x, y ) {
        return { x: x, y: y, direction: T_UP };
    }

    function DOWN( x, y ) {
        return { x: x, y: y, direction: T_DOWN };
    }
    */



    function addCnPos ( cn_pos, numCol, pins, isLeft )
    {
        var pinName,
            pinCol,
            extX = 0, y;

        for ( pinName in pins ) {
            if ( pins.hasOwnProperty( pinName ) ) {
                pinCol = pins[pinName];

                if ( pinCol < 1 || pinCol > numCol ) {
                    error( 'out of pin column index' );
                }

                y = DIP_H_PAD + DIP_H_UNIT * (pinCol-1) + DIP_H_UNIT/2;

                if ( isActiveLow( pinName ) ) {
                    extX = 6;

                    if ( isLeft ) {
                        extX = -extX;
                    }
                }

                if ( isLeft ) {
                    cn_pos[pinName] = LEFT( extX, y );
                } else {
                    cn_pos[pinName] = RIGHT( DIP_WIDTH + extX, y );
                }
            }
        }
    }



    function setupElement ( ctx, e, base, args )
    {
        var i, cn, pinName, name;

        this.isFlipped = false;

        if ( args ) {
            args = Array.prototype.slice.call( args, 0 );

            e.x = args[0] || 0;
            e.y = args[1] || 0;
        }
        else
        {
            e.x = 0;
            e.y = 0;
        }


        if ( base && e.cn_pos )
        {
            e.cn = {};

            for ( pinName in e.cn_pos ) {
                if ( e.cn_pos.hasOwnProperty( pinName ) ) {
                    if ( ! base[pinName] ) {
                        error( pinName + ' is not a pin name' );
                    }

                    cn = new Connector( ctx, e, e.cn_pos[pinName], base[pinName] );

                    e.cn[pinName] = cn;
                    base[pinName].addChangeListener( cn );
                }
            }
        }


        if ( base && base.PINS )
        {
            e.PINS = base.PINS;

            for ( i = 0; i < base.PINS.length; i++ ) {
                if ( base.PINS[i] )
                {
                    e[base.PINS[i].name] = base[base.PINS[i].name];
                    e['PIN' + (i+1)] = base['PIN' + (i+1)];
                }
            }
        }


        Object.getPrototypeOf(e).setPos = function ( x, y )
        {
            this.x = x;
            this.y = y;
        };


        Object.getPrototypeOf(e).flip = function ()
        {
            this.isFlipped = ! this.isFlipped;
        };


        for ( name in base ) {
            if ( typeof base[name] === 'function' && ! e[name] ) {
                e[name] = bind( base, name );
            }
        }
    }



    function fixPoint( pt )
    {
        pt.x = Math.round( pt.x );
        pt.y = Math.round( pt.y );

        return pt;
    }



    Path = (function ()
    {
        function Path ( ctx )
        {
            this.ctx = ctx;
            this.i = 0;
            this.path = [];
            this.points = null;
            this.signal = 0;

            this.cns = [];
            this.align_tbl = {};
        }


        Path.prototype.draw = function ()
        {
            var ctx = this.ctx;

            if ( this.points )
            {
                this.path.push( this.points );
                this.points = undefined;
            }

            if ( this.path.length === 0 ) {
                return;
            }

            ctx.save();

            ctx.lineWidth = 3;
            ctx.strokeStyle = getSignalColor( this.signal );
            ctx.fillStyle = ctx.strokeStyle;

            this._drawSub();

            ctx.restore();
        };


        Path.prototype._drawSub = function ()
        {
            var k, i, points, ctx = this.ctx;

            for ( k = 0; k < this.path.length; k++ )
            {
                points = this.path[k];

                if ( points.length < 2 ) {
                    continue;
                }

                if ( k !== 0 )
                {
                    ctx.beginPath();
                    ctx.arc( points[0].x, points[0].y, 4, 0, PI2 );
                    ctx.fill();
                }

                ctx.beginPath();

                ctx.moveTo( points[0].x, points[0].y );

                for ( i = 1; i < points.length; i++ ) {
                    ctx.lineTo( points[i].x, points[i].y );

                }

                ctx.stroke();
            }
        };


        Path.prototype.action = function ( s )
        {
            this.signal = s;

            this.draw();
        };


        Path.prototype.probe = function ( p )
        {
            var s;

            if ( p.isWire ) {
                p.addChangeListener( this );
                s = p.getSignal();
            } else if ( p.isConnector ) {
                p.inn.addChangeListener( this );
                s = p.inn.getSignal();
            } else if ( p.isVeConnector ) {
                p.e.inn.addChangeListener( this );
                s = p.e.inn.getSignal();
            } else {
                error( "couldn't probe" );
            }

            this.signal = s;
        };


        Path.prototype.addConnector = function ( cn )
        {
            this.signal = cn.e.getSignal();
            this._prevSignalOnClock = this.signal;

            if ( this.isClockPath ) {
                cn.setClockConnector();
            }

            this.cns.push( cn );
        };


        Path.prototype.contains = function ( cn )
        {
            var i;

            for ( i = 0; i < this.cns.length; i++ )
            {
                if ( this.cns[i] === cn ) {
                    return true;
                }
            }

            return false;
        };


        Path.prototype.setAlign = function ( cn, type, d )
        {
            var i;

            for ( i = 0; i < this.cns.length; i++ )
            {
                if ( this.cns[i] === cn ) {
                    if ( ! this.align_tbl[cn] ) {
                        this.align_tbl[cn] = [];
                    }

                    this.align_tbl[cn].push( { d: d, type: type } );
                }
            }
        };


        Path.prototype.moveTo = function ()
        {
            if ( this.points ) {
                this.path.push( this.points );
            }

            this.points = [];
            this.lineTo.apply( this, arguments );
        };


        Path.prototype.lineTo = function ()
        {
            var i,
                a = arguments,
                pt;

            if ( a.length === 0 ) {
                error( 'no arguments' );
            }

            if ( ! this.points ) {
                error( 'call moveTo before call lineTo' );
            }

            if ( typeof a[0] === 'number' && (a.length % 2) === 0 ) {
                for ( i = 0; i < a.length; i += 2 ) {
                    this.points.push( fixPoint( { x: a[i], y: a[i+1] } ) );
                }
            } else if ( a.length === 1 && Object.prototype.toString.call( a[0] ) === '[object Array]' ) {
                for ( i = 0; i < a[0].length; i++ ) {
                    this.lineTo( a[0][i] );
                }
            } else if ( a.length === 1 && a[0].isVeConnector ) {
                pt = a[0].getPos();
                this.points.push( fixPoint( { x: pt.x, y: pt.y } ) );
            } else if ( a.length === 1 ) {
                this.points.push( fixPoint( { x: a[0].x, y: a[0].y } ) );
            } else {
                error( 'invalid arguments' );
            }
        };



        Path.prototype.autoPath = function ( cn1, cn2 )
        {
            var i, pt1 = cn1.getPos(), pt2 = cn2.getPos(),
                dir1 = cn1.getDirection(), dir2 = cn2.getDirection(),
                isLeftRight1, isLeftRight2,
                d = 0, d_ex1 = 0, d_ex2 = 0,
                aligns, type, x1, x2;

            if ( dir1 === T_LEFT || dir1 === T_RIGHT ) {
                isLeftRight1 = true;
            } else {
                isLeftRight1 = false;
            }

            if ( dir2 === T_LEFT || dir2 === T_RIGHT ) {
                isLeftRight2 = true;
            } else {
                isLeftRight2 = false;
            }

            if ( this.align_tbl[cn1] ) {
                aligns = this.align_tbl[cn1];

                for ( i = 0; i < aligns.length; i++ )
                {
                    if ( aligns[i].type === ALIGN_PIN_TURN ) {
                        d_ex1 = aligns[i].d;
                        continue;
                    } else if ( aligns[i].type === ALIGN_PIN ) {
                        d += (pt1.y - pt2.y) / 2;
                        continue;
                    }

                    d = aligns[i].d;
                    type = aligns[i].type;
                }
            }

            if ( this.align_tbl[cn2] ) {
                aligns = this.align_tbl[cn2];

                for ( i = 0; i < aligns.length; i++ )
                {
                    if ( aligns[i].type === ALIGN_PIN_TURN ) {
                        d_ex2 = aligns[i].d;
                        continue;
                    } else if ( aligns[i].type === ALIGN_PIN ) {
                        d += (pt2.y - pt1.y) / 2;
                        continue;
                    }

                    d = aligns[i].d;
                    type = aligns[i].type;
                }
            }

            if ( ! d ) {
                d = 0;
            }

            x1 = DIST_PIN_TURN + d_ex1;
            x2 = DIST_PIN_TURN + d_ex2;

            if ( dir1 === T_LEFT ) {
                x1 = -x1;
            }

            if ( dir2 === T_LEFT ) {
                x2 = -x2;
            }

            this.moveTo( pt1 );

            if ( isLeftRight1 !== isLeftRight2 )
            {
                if ( isLeftRight1 ) {
                    this.lineTo( pt2.x, pt1.y );
                } else {
                    this.lineTo( pt1.x, pt2.y );
                }
            }
            else if ( type === ALIGN_TOP )
            {
                this.lineTo( pt1.x + x1, pt1.y );
                this.lineTo( pt1.x + x1, d );
                this.lineTo( pt2.x + x2, d );
                this.lineTo( pt2.x + x2, pt2.y );
            }
            else if ( dir1 === dir2 )
            {
                this.lineTo( pt1.x + x1, pt1.y );

                if ( pt1.x !== pt2.x )
                {
                    this.lineTo( pt1.x + x1, (pt1.y + pt2.y) / 2 + d );
                    this.lineTo( pt2.x + x2, (pt1.y + pt2.y) / 2 + d );
                }

                this.lineTo( pt2.x + x2, pt2.y );
            }
            else
            {
                if ( isLeftRight1 ) {
                    this.lineTo( pt1.x + x1, pt1.y );
                }

                if ( pt1.y !== pt2.y )
                {
                    this.lineTo( pt1.x + x1, (pt1.y + pt2.y) / 2 + d );
                    this.lineTo( pt2.x + x2, (pt1.y + pt2.y) / 2 + d );
                }

                if ( isLeftRight2 ) {
                    this.lineTo( pt2.x + x2, pt2.y );
                }
            }

            this.lineTo( pt2 );
        };


        Path.prototype.searchNearestPoint = function ( pt )
        {
            var i,
                k,
                p,
                points,
                nearestDist = 9999,
                nearestPt = { x: pt.x, y: pt.y };

            for ( k = 0; k < this.path.length; k++ )
            {
                points = this.path[k];

                for ( i = 0; i < points.length - 1; i++ )
                {
                    p = calcLinePtDist( points[i], points[i+1], pt );

                    if ( p.dist < nearestDist ) {
                        nearestDist = p.dist;
                        nearestPt = p.pt;
                    }
                }
            }

            return nearestPt;
        };


        Path.prototype.addAutoPath = function ( cn )
        {
            var pt1 = cn.getPos(),
                pt2 = {},
                near_pt,
                i,
                aligns,
                d = 0,
                dir = cn.getDirection();

            this.moveTo( { x: 0, y: 0 } );

            if ( this.path.length === 0 ) {
                error( "can't addAutoPath to empty path" );
            }

            if ( this.align_tbl[cn] ) {
                aligns = this.align_tbl[cn];

                for ( i = 0; i < aligns.length; i++ )
                {
                    if ( aligns[i].type === ALIGN_PIN_TURN ) {
                        d = aligns[i].d;
                        continue;
                    }
                }
            }

            if ( ! d ) {
                d = 0;
            }

            if ( dir === T_LEFT ) {
                pt2.x = pt1.x - DIST_PIN_TURN - d;
            } else {
                pt2.x = pt1.x + DIST_PIN_TURN + d;
            }

            pt2.y = pt1.y;

            near_pt = this.searchNearestPoint( pt2 );

            this.points[0] = fixPoint( near_pt );

            this.lineTo( pt2 );
            this.lineTo( pt1 );
        };



        Path.prototype.getPrev = function ()
        {
            var i;

            if ( this.points.length === 0 ) {
                error( "couldn't get prev point" );
            }

            i = this.points.length - 1;

            return { x: this.points[i].x, y: this.points[i].y };
        };


        Path.prototype.left = function ( d )
        {
            var prev = this.getPrev();
            this.points.push( fixPoint( { x: prev.x - d, y: prev.y } ) );
        };


        Path.prototype.right = function ( d )
        {
            var prev = this.getPrev();
            this.points.push( fixPoint( { x: prev.x + d, y: prev.y } ) );
        };


        Path.prototype.up = function ( d )
        {
            var prev = this.getPrev();
            this.points.push( fixPoint( { x: prev.x, y: prev.y - d } ) );
        };


        Path.prototype.down = function ( d )
        {
            var prev = this.getPrev();
            this.points.push( fixPoint( { x: prev.x, y: prev.y + d } ) );
        };


        Path.prototype.calc = function ()
        {
            var farthestPair,
                farthestDist = -1,
                i, k, d, a;

            if ( this.cns.length < 2 ) {
                return;
            }

            a = this.cns.slice( 0 );  // copy

            farthestPair = [ a[0], a[1] ];

            if ( a.length > 2 )
            {
                for ( i = 0; i < a.length - 1; i++ )
                {
                    for ( k = i + 1; k < a.length; k++ )
                    {
                        d = calcPtPtDist( a[i].getPos(), a[k].getPos() );

                        if ( d > farthestDist )
                        {
                            farthestDist = d;
                            farthestPair = [ a[i], a[k] ];
                        }
                    }
                }
            }

            for ( k = 0; k < 2; k++ )
            {
                for ( i = 0; i < a.length; i++ )
                {
                    if ( a[i] === farthestPair[k] )
                    {
                        a.splice( i, 1 );
                        break;
                    }
                }
            }

            this.autoPath( farthestPair[0], farthestPair[1] );

            for ( i = 0; i < a.length; i++ )
            {
                this.addAutoPath( a[i] );
            }
        };


        return Path;
    }());



    Connector = (function ()
    {
        var instanceNo = 0;

        function Connector ( ctx, parent, cn_pos, e )
        {
            var name;

            this.ctx = ctx;
            this.instanceNo = instanceNo++;
            this.instanceName = 'ViConnector' + this.instanceNo;
            this.isVeConnector = true;

            this.parent = parent;
            this.cn_pos = cn_pos;
            this.e = e;

            // inheret
            for ( name in e ) {
                if ( typeof e[name] === 'function' && ! this[name] ) {
                    this[name] = bind( e, name );
                }
            }
        }


        Connector.prototype.toString = function ()
        {
            return this.instanceName;
        };


        Connector.prototype.draw = function ()
        {
            var x = 0, ctx = this.ctx;

            if ( this.cn_pos.direction === T_LEFT ) {
                x = -4;
            } else if ( this.cn_pos.direction === T_RIGHT ) {
                x = 4;
            }

            if ( this.parent.isFlipped ) {
                x = -x;
            }

            ctx.save();

            ctx.fillStyle = getSignalColor( this.signal );

            ctx.beginPath();
            ctx.arc( this.getX() + x, this.getY(), 4, 0, PI2 );
            ctx.fill();

            ctx.restore();
        };


        Connector.prototype.action = function ()
        {
            this.signal = this.e.getSignal();

            this.draw();
        };


        Connector.prototype.getDirection = function ()
        {
            var d = this.cn_pos.direction;

            if ( this.parent.isFlipped ) {
                if ( d === T_LEFT ) {
                    return T_RIGHT;
                }

                if ( d === T_RIGHT ) {
                    return T_LEFT;
                }
            }

            return d;
        };


        Connector.prototype.getPos = function ()
        {
            return { x: this.getX(), y: this.getY() };
        };


        Connector.prototype.getX = function ()
        {
            var x;

            if ( this.parent.isFlipped ) {
                x = this.parent.x - this.cn_pos.x;
            } else {
                x = this.parent.x + this.cn_pos.x;
            }

            return x;
        };


        Connector.prototype.getY = function ()
        {
            return this.parent.y + this.cn_pos.y;
        };


        return Connector;
    }());



    Inverter = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2,
            r = BASE_R;


        function Inverter ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.Inverter();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        Inverter.prototype.cn_pos = { A: LEFT(0, cy), Y: RIGHT(w+r*2, cy) };


        Inverter.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( -w2, -h2 );
            ctx.lineTo( -w2, h2 );
            ctx.lineTo( w2, 0 );

            ctx.closePath();
            ctx.stroke();


            ctx.beginPath();
            ctx.arc( w2 + r, 0, r, 0, PI2 );
            ctx.stroke();

            ctx.restore();
        };


        return Inverter;
    }());



    AndGate = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2;


        function AndGate ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.AndGate();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        AndGate.prototype.cn_pos = { A: LEFT(0, cy - h/4), B: LEFT(0, cy + h/4), Y: RIGHT(w, cy) };


        AndGate.prototype.draw = function ()
        {
            var x2 = w - h, ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( x2, -h2 );
            ctx.lineTo( -w2, -h2 );
            ctx.lineTo( -w2, h2 );
            ctx.lineTo( x2, h2 );

            ctx.stroke();


            ctx.beginPath();
            ctx.arc( x2, 0, h2, PI1_5, PI0_5 );
            ctx.stroke();

            ctx.restore();
        };


        return AndGate;
    }());



    OrGate = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2;


        function OrGate ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.OrGate();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        OrGate.prototype.cn_pos = { A: LEFT(12, cy - h/4), B: LEFT(12, cy + h/4), Y: RIGHT(w, cy) };


        OrGate.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( -w2, -h2 );
            ctx.quadraticCurveTo( w2/2, -h2, w2, 0 );
            ctx.quadraticCurveTo( w2/2, h2, -w2, h2 );
            ctx.quadraticCurveTo( 0, 0, -w2, -h2 );

            ctx.stroke();

            ctx.restore();
        };


        return OrGate;
    }());



    NandGate = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2,
            r = 6;


        function NandGate ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.NandGate();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        NandGate.prototype.cn_pos = { A: LEFT(0, cy - h/4), B: LEFT(0, cy + h/4), Y: RIGHT(w + r*2, cy) };


        NandGate.prototype.draw = function ()
        {
            var x2 = w - h, ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( x2, -h2 );
            ctx.lineTo( -w2, -h2 );
            ctx.lineTo( -w2, h2 );
            ctx.lineTo( x2, h2 );

            ctx.stroke();


            ctx.beginPath();
            ctx.arc( x2, 0, h2, PI1_5, PI0_5 );
            ctx.stroke();


            ctx.beginPath();
            ctx.arc( w2 + r, 0, r, 0, PI2 );
            ctx.stroke();

            ctx.restore();
        };


        return NandGate;
    }());



    NorGate = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2,
            r = BASE_R;


        function NorGate ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.NorGate();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        NorGate.prototype.cn_pos = { A: LEFT(12, cy - h/4), B: LEFT(12, cy + h/4), Y: RIGHT(w + r*2, cy) };


        NorGate.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( -w2, -h2 );
            ctx.quadraticCurveTo( w2/2, -h2, w2, 0 );
            ctx.quadraticCurveTo( w2/2, h2, -w2, h2 );
            ctx.quadraticCurveTo( 0, 0, -w2, -h2 );

            ctx.stroke();


            ctx.beginPath();
            ctx.arc( w2 + r, 0, r, 0, PI2 );
            ctx.stroke();

            ctx.restore();
        };


        return NorGate;
    }());



    XorGate = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2,
            dst = BASE_R;


        function XorGate ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.XorGate();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        XorGate.prototype.cn_pos = { A: LEFT(12, cy - h/4), B: LEFT(12, cy + h/4), Y: RIGHT(w, cy) };


        XorGate.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( -w2, -h2 );
            ctx.quadraticCurveTo( w2/2, -h2, w2, 0 );
            ctx.quadraticCurveTo( w2/2, h2, -w2, h2 );
            ctx.quadraticCurveTo( 0, 0, -w2, -h2 );

            ctx.stroke();


            ctx.beginPath();

            ctx.moveTo( -w2 - dst, -h2 );
            ctx.quadraticCurveTo( -dst, -dst, -w2 - dst, h2 );

            ctx.stroke();

            ctx.restore();
        };


        return XorGate;
    }());



    XnorGate = (function ()
    {
        var w = BASE_W,
            h = BASE_H,
            w2 = w / 2,
            h2 = h / 2,
            cx = w2,
            cy = h2,
            dst = BASE_R,
            r = BASE_R;


        function XnorGate ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ec.XnorGate();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        XnorGate.prototype.cn_pos = { A: LEFT(12, cy - h/4), B: LEFT(12, cy + h/4), Y: RIGHT(w + r*2, cy) };


        XnorGate.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.translate( this.x + cx, this.y + cy );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.moveTo( -w2, -h2 );
            ctx.quadraticCurveTo( w2/2, -h2, w2, 0 );
            ctx.quadraticCurveTo( w2/2, h2, -w2, h2 );
            ctx.quadraticCurveTo( 0, 0, -w2, -h2 );

            ctx.stroke();


            ctx.beginPath();

            ctx.moveTo( -w2 - dst, -h2 );
            ctx.quadraticCurveTo( -dst, -dst, -w2 - dst, h2 );

            ctx.stroke();


            ctx.beginPath();
            ctx.arc( w2 + r, 0, r, 0, PI2 );
            ctx.stroke();

            ctx.restore();
        };


        return XnorGate;
    }());



    DummyIN = (function ()
    {
        function DummyIN ( ctx, label )
        {
            var args;

            this.ctx = ctx;
            this.label = label;

            this.e = new ec.DummyIN();

            this.w = 0;
            this.h = 0;

            this.labelX = 0;
            this.labelY = 0;

            args = Array.prototype.slice.call( arguments, 2 );

            setupElement( ctx, this, this.e, args );
        }


        DummyIN.prototype.cn_pos = { A: LEFT(0, 0) };


        DummyIN.prototype.setLabelPos = function ( x, y )
        {
            this.labelX = x;
            this.labelY = y;
        };


        DummyIN.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.font = '18px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'left';

            ctx.translate( this.x, this.y );

            ctx.fillText( this.label, 4 + this.labelX, 6 + this.labelY );

            ctx.restore();
        };


        return DummyIN;
    }());



    DummyOUT = (function ()
    {
        function DummyOUT ( ctx, label )
        {
            var args;

            this.ctx = ctx;
            this.label = label;

            this.e = new ec.DummyOUT();

            this.w = 0;
            this.h = 0;

            this.labelX = 0;
            this.labelY = 0;

            args = Array.prototype.slice.call( arguments, 2 );

            setupElement( ctx, this, this.e, args );
        }


        DummyOUT.prototype.cn_pos = { Y: RIGHT(0, 0) };


        DummyOUT.prototype.setLabelPos = function ( x, y )
        {
            this.labelX = x;
            this.labelY = y;
        };


        DummyOUT.prototype.draw = function ()
        {
            var ctx = this.ctx;

            ctx.save();

            ctx.font = '18px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'right';

            ctx.translate( this.x, this.y );

            ctx.fillText( this.label, -4 + this.labelX, 6 + this.labelY );

            ctx.restore();
        };


        return DummyOUT;
    }());



    function createDIP_IC ( ic_class, numCol, leftPins, rightPins )
    {
        var w = DIP_WIDTH,
            h = DIP_H_UNIT * numCol + DIP_H_PAD * 2,
            r = 6;


        function DIP_IC ( ctx )
        {
            var args;

            this.ctx = ctx;

            this.e = new ic_class();

            this.w = w;
            this.h = h;

            args = Array.prototype.slice.call( arguments, 1 );

            setupElement( ctx, this, this.e, args );
        }


        DIP_IC.prototype.cn_pos = {};

        addCnPos( DIP_IC.prototype.cn_pos, numCol, leftPins, true );
        addCnPos( DIP_IC.prototype.cn_pos, numCol, rightPins, false );


        DIP_IC.prototype.draw = function ()
        {
            var ctx = this.ctx, pinName, name, pos, activeLow, x, xArc, xStr, xLine, xCk;

            ctx.save();

            ctx.translate( this.x, this.y );

            if ( this.isFlipped ) {
                ctx.scale( -1, 1 );
            }

            ctx.beginPath();

            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'white';

            ctx.lineWidth = 2;

            ctx.rect( 0, 0, w, h );

            ctx.shadowColor = '#999';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            ctx.stroke();
            ctx.fill();


            ctx.font = '18px Arial';

            ctx.shadowColor = 'transparent';

            ctx.lineWidth = 1;
            ctx.fillStyle = 'black';

            for ( pinName in this.cn_pos ) {
                if ( this.cn_pos.hasOwnProperty( pinName ) ) {
                    pos = this.cn_pos[pinName];

                    name = pinName;
                    activeLow = isActiveLow( pinName );

                    if ( activeLow ) {
                        name = name.substr(0, name.length - 2);
                    }

                    if ( hasSubscript( name ) ) {
                        name = name.charAt( name.length - 1 ) + name.substr(0, name.length - 2);
                    }


                    activeLow = isActiveLow( pinName );

                    if ( pos.direction === T_RIGHT ) {
                        ctx.textAlign = 'right';
                        x = w;
                        xArc = pos.x - 6;
                        xStr = x - 6;
                        xLine = xStr - ctx.measureText(name).width;
                        xCk = x - 6;

                    }
                    else
                    {
                        ctx.textAlign = 'left';
                        x = 0;
                        xArc = pos.x + 6;
                        xStr = x + 6;
                        xLine = xStr + ctx.measureText(name).width;
                        xCk = x + 6;
                    }

                    if ( activeLow ) {
                        ctx.beginPath();
                        ctx.arc( xArc, pos.y, r, 0, PI2 );
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo( xStr, pos.y - 5 );
                        ctx.lineTo( xLine, pos.y - 5 );
                        ctx.stroke();
                    }

                    if ( pinName === 'CK' )
                    {
                        ctx.beginPath();
                        ctx.moveTo( x, pos.y - 6 );
                        ctx.lineTo( xCk, pos.y );
                        ctx.lineTo( x, pos.y + 6 );
                        ctx.stroke();
                    }

                    ctx.fillText( name, xStr, pos.y + 6 );
                }
            }

            ctx.restore();
        };


        return DIP_IC;
    }



    function createAutoPath ( ctx, elems )
    {
        var i, tmp;

        if ( Object.prototype.toString.call( elems ) === '[object Array]' )
        {
            tmp = {};

            for ( i = 0; i < elems.length; i++ ) {
                tmp['e' + i] = elems[i];
            }

            elems = tmp;
        }


        function AutoPath ()
        {
            var i, e, name, cn_pos, pinName, wire, path, cns, wireName;

            this.wire2cn = {};
            this.paths = [];

            for ( name in elems ) {
                if ( elems.hasOwnProperty( name ) ) {
                    e = elems[name];

                    cn_pos = e.cn_pos;

                    for ( pinName in cn_pos ) {
                        if ( cn_pos.hasOwnProperty( pinName ) ) {
                            wire = e[pinName].out;

                            if ( ! wire ) {
                                continue;
                            }

                            if ( ! this.wire2cn[wire] ) {
                                this.wire2cn[wire] = [ wire ];
                            }

                            this.wire2cn[wire].push( e.cn[pinName] );
                        }
                    }
                }
            }


            for ( wireName in this.wire2cn ) {
                if ( this.wire2cn.hasOwnProperty( wireName ) ) {
                    cns = this.wire2cn[wireName];

                    path = new Path( ctx );
                    path.probe( cns[0] );
                    this.paths.push( path );

                    for ( i = 1; i < cns.length; i++ ) {
                        path.addConnector( cns[i] );
                    }
                }
            }
        }


        AutoPath.prototype.setAlign = function ( cn, type, d )
        {
            var i;

            for ( i = 0; i < this.paths.length; i++ ) {
                if ( this.paths[i].contains( cn ) ) {
                    this.paths[i].setAlign( cn, type, d );
                    break;
                }
            }
        };


        AutoPath.prototype.calc = function ()
        {
            var i;

            for ( i = 0; i < this.paths.length; i++ ) {
                this.paths[i].calc();
            }
        };


        AutoPath.prototype.getPath = function ( cn )
        {
            var i;

            for ( i = 0; i < this.paths.length; i++ ) {
                if ( this.paths[i].contains( cn ) ) {
                    return this.paths[i];
                }
            }
        };


        AutoPath.prototype.draw = function ()
        {
            var i;

            for ( i = 0; i < this.paths.length; i++ ) {
                this.paths[i].draw();
            }
        };


        return new AutoPath();
    }



    function drawLabel ( ctx, text, e, direction )
    {
        var x;

        ctx.save();

        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black';

        x = e.x + e.w/2;

        if ( direction === T_DOWN ) {
            ctx.fillText( text, x, e.y + e.h + 20 );
        } else {
            ctx.fillText( text, x, e.y - 6 );
        }

        ctx.restore();
    }



    return {
        createDIP_IC: createDIP_IC,
        createAutoPath: createAutoPath,
        drawLabel: drawLabel,

        DIP_WIDTH: DIP_WIDTH,
        DIP_H_UNIT: DIP_H_UNIT,
        DIP_H_PAD: DIP_H_PAD,

        ALIGN_MID: ALIGN_MID,
        ALIGN_PIN: ALIGN_PIN,
        ALIGN_PIN_TURN: ALIGN_PIN_TURN,
        ALIGN_TOP: ALIGN_TOP,

        T_LEFT: T_LEFT,
        T_RIGHT: T_RIGHT,
        T_UP: T_UP,
        T_DOWN: T_DOWN,

        DummyIN: DummyIN,
        DummyOUT: DummyOUT,

        Path: Path,
        Inverter: Inverter,
        AndGate: AndGate,
        OrGate: OrGate,
        NandGate: NandGate,
        NorGate: NorGate,
        XorGate: XorGate,
        XnorGate: XnorGate
    };
}());

