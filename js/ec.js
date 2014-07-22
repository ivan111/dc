/*
 * ec.js
 * Electronic Circuit module
*/

/*jslint           browser : true,   continue : true,
  devel  : true,    indent : 4,       maxerr  : 50,
  newcap : true,     nomen : true,   plusplus : true,
  regexp : true,    sloppy : true,       vars : false,
  white  : true,  bitwise  : true
*/
/*global ec */

var ec = (function () {

    var indexOf,

        T_IN = 1, T_OUT = 2, T_VCC = 3, T_GND = 4,

        agenda,

        logicalAnd, logicalOr, logicalNand, logicalNor, logicalXor, logicalXnor,

        Wire,
        InConnector, OutConnector,
        DummyIN, DummyOUT,
        Inverter, OrGate, AndGate, NandGate, NorGate, XorGate, XnorGate,
        DFlipFlop, HalfAdder, FullAdder;


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



    indexOf = function ( needle )
    {
        var indexOf;

        if ( typeof Array.prototype.indexOf === 'function' )
        {
            indexOf = Array.prototype.indexOf;
        }
        else
        {
            indexOf = function ( needle )
            {
                var i = -1, index = -1;

                for ( i = 0; i < this.length; i++ )
                {
                    if ( this[i] === needle )
                    {
                        index = i;
                        break;
                    }
                }

                return index;
            };
        }

        return indexOf.call( this, needle );
    };



    agenda = {
        isProcessing: false,
        queue: [],


        add: function ( fn )
        {
            this.queue.push( fn );
        },


        start: function ()
        {
            var fn;

            if ( this.isProcessing )
            {
                return;
            }

            this.isProcessing = true;

            while ( this.queue.length > 0 && this.isProcessing )
            {
                fn = this.queue.shift();

                fn();
            }

            this.isProcessing = false;
        },


        stop: function ()
        {
            this.isProcessing = false;
        }

    };



    function start () {
        agenda.start();
    }

    function delay ( fn ) {
        agenda.add( fn );
    }



    function IN ( pinName ) {
        return { type: T_IN, name: pinName };
    }

    function OUT ( pinName ) {
        return { type: T_OUT, name: pinName };
    }



    function setupElement ( e, pins, wires ) {
        var i, name, pin, cn;

        e.PINS = pins;


        if ( ! e.action ) {
            if ( e._action ) {
                Object.getPrototypeOf(e).action = function () { delay( bind( this, '_action' ) ); };
            } else {
                Object.getPrototypeOf(e).action = function () { return; };
            }
        }


        for ( i = 0; i < pins.length; i++ )
        {
            if ( ! pins[i] ) {
                continue;
            }

            switch ( pins[i].type )
            {
            case T_IN:
                pin = new InConnector( e );
                break;

            case T_OUT:
                pin = new OutConnector();
                break;

            case T_VCC:
                pin = null;
                break;

            case T_GND:
                pin = null;
                break;

            default:
                error( 'unknown io type' );
                break;
            }

            name = pins[i].name;

            if ( e[name] ) {
                error( name + ' exists already' );
            }

            e[name] = pin;
            e['PIN' + (i+1)] = pin;
        }


        if ( wires ) {
            wires = Array.prototype.slice.call( wires, 0 );

            for ( i = 0; i < wires.length; i++ )
            {
                cn = e['PIN' + (i+1)];

                if ( cn ) {
                    cn.connect( wires[i] );
                }
            }
        }


        Object.getPrototypeOf(e).connect = function ( pin, wire )
        {
            if ( ! this[pin] ) {
                error( 'has not ' + pin + ' pin' );
            }

            this[pin].connect( wire );
        };
    }



    Wire = (function ()
    {
        var instanceNo = 0;

        function Wire ()
        {
            this.instanceNo = instanceNo++;
            this.instanceName = 'Wire' + this.instanceNo;

            this.isWire = true;
            this._signal = 0;
            this._listeners = [];
        }


        Wire.prototype.toString = function ()
        {
            return this.instanceName;
        };


        Wire.prototype.getSignal = function ()
        {
            return this._signal;
        };


        Wire.prototype.setDelayedSignal = function ( val )
        {
            this.setSignal( val, true );
        };


        Wire.prototype.setSignal = function ( val, isDelayed )
        {
            var wire, fn;

            if ( val === 0 || val === 1 )
            {
                if ( this._signal !== val )
                {
                    wire = this;

                    fn = function () {
                        wire._signal = val;

                        wire.notifyListeners();
                    };

                    if ( isDelayed ) {
                        delay( fn );
                    } else {
                        fn();
                    }
                }
            }
            else
            {
                error( 'Invalid signal ' + val );
            }
        };


        Wire.prototype.addChangeListener = function ( listener )
        {
            var i = indexOf.call( this._listeners, listener );

            if ( i !== -1 ) {
                error( "couldn't add the listener. this listener was already added" );
            }

            this._listeners.push( listener );
        };


        Wire.prototype.removeChangeListener = function ( listener )
        {
            var i = indexOf.call( this._listeners, listener );

            if ( i === -1 ) {
                error( "couldn't remove the listener. this listener doesn't exist" );
            }

            this._listeners.splice( i, 1 );
        };


        Wire.prototype.notifyListeners = function ()
        {
            var i;

            for ( i = 0; i < this._listeners.length; i++ ) {
                this._listeners[i].action( this._signal );
            }
        };


        return Wire;
    }());



    function createConnector ( isInput )
    {
        function Connector ( listener )
        {
            this.isConnector = true;
            this.inn = new Wire();
            this.out = null;

            if ( ! isInput ) {
                this.inn.addChangeListener( this );
            }

            if ( listener ) {
                this.addChangeListener( listener );
            }
        }


        Connector.prototype.isInput = function ()
        {
            return isInput;
        };


        Connector.prototype.isOutput = function ()
        {
            return ! isInput;
        };


        Connector.prototype.isConnected = function ()
        {
            if ( this.out ) {
                return true;
            }

            return false;
        };


        Connector.prototype.addChangeListener = function ( listener )
        {
            this.inn.addChangeListener( listener );
        };


        Connector.prototype.connect = function ( p )
        {
            var wire;

            if ( p.isWire )
            {
                wire = p;

                if ( this.out ) {
                    error( "couldn't connect wire" );
                }
            }
            else if ( p.isConnector )
            {
                if ( this.isOutput() && p.isOutput() ) {
                    error( "couldn't connect. output <=> output" );
                }

                if ( this.isInput() && p.isInput() ) {
                    error( "couldn't connect. input <=> input" );
                }

                if ( this.out && ! p.out )
                {
                    p.connect( this );
                    return;
                }

                if ( ! this.out && p.out )
                {
                    wire = p.out;
                }
                else if ( ! this.out && ! p.out )
                {
                    wire = new Wire();
                    p.connect( wire );
                }
                else
                {
                    error( "couldn't connect. wire <=> wire" );
                }
            }
            else
            {
                error( "couldn't connect type" );
            }

            this.out = wire;

            if ( isInput ) {
                wire.addChangeListener( this );
            }

            this.action();
        };


        Connector.prototype.action = function ()
        {
            if ( ! this.out ) {
                return;
            }

            if ( this.inn.getSignal() === this.out.getSignal() ) {
                return;
            }

            if ( isInput ) {
                this.inn.setSignal( this.out.getSignal() );
            } else {
                this.out.setSignal( this.inn.getSignal() );
            }
        };


        Connector.prototype.getSignal = function ()
        {
            return this.inn.getSignal();
        };


        Connector.prototype.setSignal = function ( val )
        {
            if ( isInput ) {
                error( 'can not set signal to a input connector' );
            }

            this.inn.setSignal( val );
        };


        return Connector;
    }



    InConnector = createConnector( true );
    OutConnector = createConnector( false );



    DummyIN = (function ()
    {
        var pins = [ IN('A') ];

        function DummyIN ()
        {
            setupElement( this, pins, arguments );
        }


        return DummyIN;
    }());



    DummyOUT = (function ()
    {
        var pins = [ OUT('Y') ];

        function DummyOUT ()
        {
            setupElement( this, pins, arguments );
        }


        DummyOUT.prototype._action = function ()
        {
            this.Y.setSignal( this.signal );
        };


        return DummyOUT;
    }());



    DFlipFlop = (function ()
    {
        var pins = [ IN('CK'), IN('D'), IN('CLR_B'), IN('PR_B'), OUT('Q'), OUT('Q_B') ];

        function DFlipFlop ()
        {
            setupElement( this, pins, arguments );
        }


        DFlipFlop.prototype._action = function ()
        {
            var ck_val = this.CK.getSignal(),
                d_val;

            if ( this.CLR_B.getSignal() === 0 )
            {
                this.Q.setSignal( 0 );
                this.Q_B.setSignal( 1 );
            }
            else if ( this.PR_B.getSignal() === 0 )
            {
                this.Q.setSignal( 1 );
                this.Q_B.setSignal( 0 );
            }
            else if ( this._prev_ck === 0 && ck_val === 1 )
            {
                d_val = this.D.getSignal();

                if ( d_val === 0 || d_val === 1 )
                {
                    this.Q.setSignal( d_val );
                    this.Q_B.setSignal( 1 - d_val );
                }
                else
                {
                    this.Q.setSignal( null );
                    this.Q_B.setSignal( null );
                }
            }

            this._prev_ck = ck_val;
        };


        return DFlipFlop;
    }());



    function logicalNot ( s )
    {
        if ( s === 0 ) {
            return 1;
        }

        if ( s === 1 ) {
            return 0;
        }

        error( '[not] Invalid signal. s = ' + s );
    }



    function createIn2LogicalFunction( name, tbl )
    {
        return function ( s1, s2 ) {
            var i = 0;

            for ( i = 0; i < tbl.length; i++ ) {
                if ( tbl[i][0] === s1 && tbl[i][1] === s2 ) {
                    return tbl[i][2];
                }
            }

            error( '[' + name + '] Invalid signal. s1 = ' + s1 + ', s2 = ' + s2 );
        };
    }


    logicalAnd = createIn2LogicalFunction( 'and', [
            [ 0, 0, 0 ],
            [ 0, 1, 0 ],
            [ 1, 0, 0 ],
            [ 1, 1, 1 ] ] );


    logicalOr = createIn2LogicalFunction( 'or', [
            [ 0, 0, 0 ],
            [ 0, 1, 1 ],
            [ 1, 0, 1 ],
            [ 1, 1, 1 ] ] );


    logicalNand = createIn2LogicalFunction( 'nand', [
            [ 0, 0, 1 ],
            [ 0, 1, 1 ],
            [ 1, 0, 1 ],
            [ 1, 1, 0 ] ] );


    logicalNor = createIn2LogicalFunction( 'nor', [
            [ 0, 0, 1 ],
            [ 0, 1, 0 ],
            [ 1, 0, 0 ],
            [ 1, 1, 0 ] ] );


    logicalXor = createIn2LogicalFunction( 'xor', [
            [ 0, 0, 0 ],
            [ 0, 1, 1 ],
            [ 1, 0, 1 ],
            [ 1, 1, 0 ] ] );


    logicalXnor = createIn2LogicalFunction( 'xnor', [
            [ 0, 0, 1 ],
            [ 0, 1, 0 ],
            [ 1, 0, 0 ],
            [ 1, 1, 1 ] ] );



    Inverter = (function ()
    {
        var pins = [ IN('A'), OUT('Y') ];

        function Inverter ()
        {
            setupElement( this, pins, arguments );

            this._action();
        }


        Inverter.prototype._action = function ()
        {
            var val = logicalNot( this.A.getSignal() );

            this.Y.setSignal( val );
        };


        return Inverter;
    }());



    function createIn2LogicGate ( name, logicalFunction )
    {
        var pins = [ IN('A'), IN('B'), OUT('Y') ];

        function In2LogicGate ()
        {
            setupElement( this, pins, arguments );

            this._action();
        }


        In2LogicGate.prototype.name = name;


        In2LogicGate.prototype._action = function ()
        {
            var val = logicalFunction( this.A.getSignal(), this.B.getSignal() );

            this.Y.setSignal( val );
        };


        return In2LogicGate;
    }



    AndGate  = createIn2LogicGate( 'and',  logicalAnd );
    OrGate   = createIn2LogicGate( 'or',   logicalOr );
    NandGate = createIn2LogicGate( 'nand', logicalNand );
    NorGate  = createIn2LogicGate( 'nor',  logicalNor );
    XorGate  = createIn2LogicGate( 'xor',  logicalXor );
    XnorGate = createIn2LogicGate( 'xnor', logicalXnor );



    HalfAdder = (function ()
    {
        var pins = [ IN('A'), IN('B'), OUT('S'), OUT('C') ];

        function HalfAdder ()
        {
            var d = new Wire(),
                e = new Wire();

            setupElement( this, pins, arguments );

            this.elems = [];
            this.elems[0]   = new OrGate( this.A.inn, this.B.inn, d );
            this.elems[1] = new AndGate( this.A.inn, this.B.inn, this.C.inn );
            this.elems[2]  = new Inverter( this.C.inn, e );
            this.elems[3] = new AndGate( d, e, this.S.inn );
        }


        return HalfAdder;
    }());



    FullAdder = (function ()
    {
        var pins = [ IN('A'), IN('B'), IN('C_IN'), OUT('S'), OUT('C_OUT') ];

        function FullAdder ()
        {
            var s  = new Wire(),
                c1 = new Wire(),
                c2 = new Wire();

            setupElement( this, pins, arguments );

            this.elems = [];
            this.elems[0] = new HalfAdder( this.B.inn, this.C_IN.inn, s, c1 );
            this.elems[1] = new HalfAdder( this.A.inn, s, this.S.inn, c2 );
            this.elems[2] = new OrGate( c1, c2, this.C_OUT.inn );
        }


        return FullAdder;
    }());



    return {
        Wire: Wire,

        DummyIN: DummyIN,
        DummyOUT: DummyOUT,

        Inverter: Inverter,
        AndGate: AndGate,
        OrGate: OrGate,
        NandGate: NandGate,
        NorGate: NorGate,
        XorGate: XorGate,
        XnorGate: XnorGate,

        DFlipFlop: DFlipFlop,
        HalfAdder: HalfAdder,
        FullAdder: FullAdder,

        delay: delay,
        start: start
    };
}());

