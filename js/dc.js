/*
 * dc.js
 * Degital Circuit module
*/

/*jslint         browser : true, continue : true,
  devel  : true, indent  : 4,    maxerr   : 50,
  newcap : true, nomen   : true, plusplus : true,
  regexp : true, sloppy  : true, vars     : false,
  white  : true, bitwise : true
*/
/*global $, ec, ve, dc */

dc = (function ()
{
    var
        SW_SUB_LEFT = 50,
        SW_SUB_TOP = 12,
        DIST = 52,
        COLOR_BG = '#EEE',

        SW_HTML = '<input type="checkbox" name="onoffswitch" class="onoffswitch-checkbox" id="{{ID_NAME}}">'
                + '<label class="onoffswitch-label" for="{{ID_NAME}}">'
                    + '<span class="onoffswitch-inner"></span>'
                    + '<span class="onoffswitch-switch"></span>'
                + '</label>',

        numCanvases = 0,
        numSwitches = 0,

        createAndGate,
        createOrGate,
        createNandGate,
        createNorGate,
        createXorGate,
        createXnorGate,

        HalfAdder;


    HalfAdder = ve.createDIP_IC( ec.HalfAdder, 2,
            { A: 1, B: 2 },
            { C: 1, S: 2 } );


    function createCanvas ( $container, idName, width, height )
    {
        var $canvas, $canvasDiv, ctx;

        idName += (numCanvases++);

        $canvasDiv = $( '<div class="dc-schematic"></div>' );
        $canvas = $( [ '<canvas id="', idName, '" width="', width, '" height="', height, '">Canvas not supported</canvas>' ].join( '' ) );
        $canvasDiv.append( $canvas );
        $container.append( $canvasDiv );
        ctx = $canvas[0].getContext( '2d' );

        ctx.beginPath();
        ctx.fillStyle = COLOR_BG;
        ctx.rect( 0, 0, width, height );
        ctx.fill();

        return ctx;
    }



    function createSwitch ( $container, cn, x, y )
    {
        var idName = 'dc-sw' + (numSwitches++), $swDiv, $sw, $canvas, bbox;

        $swDiv = $( '<div class="onoffswitch"></div>' );
        $swDiv.append( SW_HTML.replace( '{{ID_NAME}}', idName ).replace( '{{ID_NAME}}', idName ) );

        $canvas = $container.find( 'canvas' );
        bbox = $canvas[0].getBoundingClientRect();

        $swDiv.css( {
            position:  'absolute',
            left: bbox.left + x - SW_SUB_LEFT,
            top: bbox.top + y - SW_SUB_TOP
        } );

        $container.append( $swDiv );

        $sw = $swDiv.find( 'input[type=checkbox]' );

        $sw.change( function () {
            if ( $(this).is( ':checked' ) ) {
                cn.inn.setSignal( 1 );
            } else {
                cn.inn.setSignal( 0 );
            }

            ec.start();
        } );

        return $sw;
    }



    function createWiresAndSwitches ( $container, ctx, elems )
    {
        var e, name, cnName, cn, wire, x, y;

        for ( name in elems) {
            if ( ! elems.hasOwnProperty( name ) ) {
                continue;
            }

            e = elems[name];

            for ( cnName in e.cn ) {
                if ( ! e.cn.hasOwnProperty( cnName ) ) {
                    continue;
                }

                cn = e.cn[cnName];

                if ( cn.isConnected() ) {
                    continue;
                }

                wire = new ve.Path( ctx );
                wire.probe( cn );
                wire.moveTo( cn );

                x = cn.getX();
                y = cn.getY();

                if ( cn.getDirection() === ve.T_LEFT ) {
                    wire.left( DIST );
                    x -= DIST;
                } else {
                    wire.right( DIST );
                    x += DIST;
                }

                if ( cn.isInput() ) {
                    createSwitch( $container, cn.e, x, y );
                }

                wire.draw();
            }
        }
    }



    function setRelativePos ( elem, baseElem, dx, dy )
    {
        var e, baseX, baseY;

        if ( ! dx ) {
            dx = 0;
        }

        if ( ! dy ) {
            dy = 0;
        }

        if ( elem.isVeConnector ) {
            e = elem.parent;
            dx -= elem.cn_pos.x;
            dy -= elem.cn_pos.y;
        } else {
            e = elem;
        }

        if ( baseElem.isVeConnector ) {
            baseX = baseElem.getX();
            baseY = baseElem.getY();
        } else {
            baseX = baseElem.x;
            baseY = baseElem.y;
        }

        e.x = baseX + dx;
        e.y = baseY + dy;

        return e;
    }



    function createTableSelector ( $tbl, tbl, inConnectors )
    {
        function TableSelector ()
        {
            return;
        }


        TableSelector.prototype.action = function () {
            $tbl.find( 'tr.selected' ).removeClass( 'selected' );

            $tbl.find( 'tr' ).each( function ( rowNo ) {
                var i, found = true, signals = [];

                if ( rowNo < 2 ) {
                    return;
                }

                for ( i = 0; i < inConnectors.length; i++ ) {
                    signals.push( inConnectors[i].getSignal() );
                }

                $( this ).find( 'td' ).each( function ( colNo ) {
                    var tblVal;

                    if ( colNo < inConnectors.length ) {
                        tblVal = tbl[rowNo][0][colNo];
                        if ( tblVal !== 'X' && tblVal !== signals[colNo] ) {
                            found = false;
                            return;
                        }
                    }
                } );

                if ( found ) {
                    $( $tbl.find( 'tr' )[rowNo] ).addClass( 'selected' );
                }
            } );
        };


        return new TableSelector();
    }



    function createTruthTable ( $container, tbl )
    {
        var i,
            backupTbl = tbl.slice( 0 ),
            connectors = tbl.shift().slice( 0 ),
            inConnectors = connectors.shift(),
            labels = tbl.shift().slice( 0 ),
            inLabels = labels.shift(),
            outLabels = labels.shift(),
            vals, inVals, outVals, selector, onRowClick,
            $tbl, $ioRow, $labelsRow, $valsRow, $th, $td;

        $tbl = $( '<table class="dc-truth-table"></table>' );

        $ioRow = $( '<tr></tr>' );
        $tbl.append( $ioRow );

        if ( inLabels.length === 1 ) {
            $ioRow.append( $( '<th>INPUT</th>' ) );
        } else {
            $ioRow.append( $( [ '<th colspan="', inLabels.length, '">INPUT</th>' ].join( '' ) ) );
        }

        if ( outLabels.length === 1 ) {
            $ioRow.append( $( '<th class="dc-output-start">OUTPUT</th>' ) );
        } else {
            $ioRow.append( $( [ '<th class="dc-output-start" colspan="', outLabels.length, '">OUTPUT</th>' ].join( '' ) ) );
        }


        $labelsRow = $( '<tr></tr>' );
        $tbl.append( $labelsRow );

        for ( i = 0; i < inLabels.length; i++ ) {
            $labelsRow.append( $( [ '<th>', inLabels[i], '</th>' ].join( '' ) ) );
        }

        for ( i = 0; i < outLabels.length; i++ ) {
            $th = $( [ '<th>', outLabels[i], '</th>' ].join( '' ) );

            if ( i === 0 ) {
                $th.addClass( 'dc-output-start' );
            }

            $labelsRow.append( $th );
        }

        onRowClick = function () {
            var i, rowIndex = $( this ).index(), tblVal;

            if ( $( this ).hasClass( 'selected' ) ) {
                return;
            }

            for ( i = 0; i < inConnectors.length; i++ ) {
                tblVal = backupTbl[rowIndex][0][i];

                if ( tblVal !== 'X' && tblVal !== inConnectors[i].getSignal() ) {
                    inConnectors[i].$sw.click();
                }
            }
        };

        while ( tbl.length )
        {
            vals = tbl.shift().slice( 0 );
            inVals = vals.shift();
            outVals = vals.shift();

            $valsRow = $( '<tr></tr>' );
            $tbl.append( $valsRow );

            for ( i = 0; i < inLabels.length; i++ ) {
                $valsRow.append( $( [ '<td>', inVals[i], '</td>' ].join( '' ) ) );
            }

            for ( i = 0; i < outLabels.length; i++ ) {
                $td = $( [ '<td>', outVals[i], '</td>' ].join( '' ) );

                if ( i === 0 ) {
                    $td.addClass( 'dc-output-start' );
                }

                $valsRow.append( $td );
            }

            $valsRow.click( onRowClick );
        }

        selector = createTableSelector( $tbl, backupTbl, inConnectors );

        for ( i = 0; i < inConnectors.length; i++ ) {
            inConnectors[i].addChangeListener( selector );
        }

        $( $tbl.find( 'tr' )[2] ).addClass( 'selected' );

        $container.append( $tbl );

        $container.append( $( '<div style="clear: both;"></div>' ) );

        return $tbl;
    }



    function createDummy ( $container, ctx, label, baseElem, baseCnName, dist )
    {
        var e, dummyCn, dummyVeCn, baseCn, baseVeCn;

        baseCn = baseElem[baseCnName];
        baseVeCn = baseElem.cn[baseCnName];

        if ( baseCn.isInput() ) {
            e = new ve.DummyOUT( ctx, label );
            dummyCn = e.Y;
            dummyVeCn = e.cn.Y;

            e.setLabelPos( -SW_SUB_LEFT, 0 );

            if ( ! dist ) {
                dist = -DIST;
            }
        } else {
            e = new ve.DummyIN( ctx, label );
            dummyCn = e.A;
            dummyVeCn = e.cn.A;

            if ( ! dist ) {
                dist = DIST;
            }
        }

        dummyCn.connect( baseCn );

        setRelativePos( dummyVeCn, baseVeCn, dist, 0 );

        if ( dummyCn.isOutput() ) {
            e.Y.$sw = createSwitch( $container, dummyCn, dummyVeCn.getX(), dummyVeCn.getY() );
        }

        return e;
    }



    function updateSwitchPos ( $container, dummy )
    {
        var $swDiv = dummy.Y.$sw.parent(), $canvas, bbox;

        $canvas = $container.find( 'canvas' );
        bbox = $canvas[0].getBoundingClientRect();

        $swDiv.css( {
            position:  'absolute',
            left: bbox.left + dummy.cn.Y.getX() - SW_SUB_LEFT,
            top: bbox.top + dummy.cn.Y.getY() - SW_SUB_TOP
        } );
    }



    function draw( elems, paths )
    {
        var name, pinName;

        for ( name in elems) {
            if ( ! elems.hasOwnProperty( name ) ) {
                continue;
            }

            elems[name].draw();

            for ( pinName in elems[name].cn_pos ) {
                if ( ! elems[name].cn_pos.hasOwnProperty( pinName ) ) {
                    continue;
                }

                elems[name].cn[pinName].action();
            }
        }

        if ( ! paths ) {
            return;
        }

        paths.calc();
        paths.draw();
    }



    function createNotGate ( $container )
    {
        var ctx, elems = {}, w = 360, h = 100, truthTable, paths;

        ctx = createCanvas( $container, 'dc-not-canvas', w, h );

        elems.gate = new ve.Inverter( ctx, 140, 20 );

        elems.a = createDummy( $container, ctx, 'A', elems.gate, 'A' );
        elems.y = createDummy( $container, ctx, 'NOT A', elems.gate, 'Y' );

        createWiresAndSwitches( $container, ctx, elems );

        truthTable = [
            [[elems.a.Y], [elems.gate.Y]],
            [['A'], ['NOT A']],
            [[0], [1]],
            [[1], [0]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        draw( elems, paths );
    }



    function createIn2LogicGate ( constructor, canvasId, opStr, truthTable )
    {
        return function ( $container ) {
            var ctx, elems = {}, w = 360, h = 100, label, paths;

            ctx = createCanvas( $container, canvasId, w, h );

            elems.gate = new constructor( ctx, 140, 20 );

            label = ['A', opStr, 'B'].join( ' ' );

            elems.a = createDummy( $container, ctx, 'A', elems.gate, 'A' );
            elems.b = createDummy( $container, ctx, 'B', elems.gate, 'B' );
            elems.y = createDummy( $container, ctx, label, elems.gate, 'Y' );

            createWiresAndSwitches( $container, ctx, elems );

            truthTable.unshift( [['A', 'B'], [label]] );
            truthTable.unshift( [[elems.a.Y, elems.b.Y], [elems.gate.Y]] );

            createTruthTable( $container, truthTable );

            paths = ve.createAutoPath( ctx, elems );

            draw( elems, paths );
        };
    }


    createAndGate = createIn2LogicGate( ve.AndGate, 'dc-and-canvas', 'AND' , [
            [[0, 0], [0]],
            [[0, 1], [0]],
            [[1, 0], [0]],
            [[1, 1], [1]] ] );


    createOrGate = createIn2LogicGate( ve.OrGate, 'dc-or-canvas', 'OR', [
            [[0, 0], [0]],
            [[0, 1], [1]],
            [[1, 0], [1]],
            [[1, 1], [1]] ] );


    createNandGate = createIn2LogicGate( ve.NandGate, 'dc-nand-canvas', 'NAND', [
            [[0, 0], [1]],
            [[0, 1], [1]],
            [[1, 0], [1]],
            [[1, 1], [0]] ] );


    createNorGate = createIn2LogicGate( ve.NorGate, 'dc-nor-canvas', 'NOR', [
            [[0, 0], [1]],
            [[0, 1], [0]],
            [[1, 0], [0]],
            [[1, 1], [0]] ] );


    createXorGate = createIn2LogicGate( ve.XorGate, 'dc-xor-canvas', 'XOR', [
            [[0, 0], [0]],
            [[0, 1], [1]],
            [[1, 0], [1]],
            [[1, 1], [0]] ] );


    createXorGate = createIn2LogicGate( ve.XorGate, 'dc-xor-canvas', 'XOR', [
            [[0, 0], [0]],
            [[0, 1], [1]],
            [[1, 0], [1]],
            [[1, 1], [0]] ] );


    createXnorGate = createIn2LogicGate( ve.XnorGate, 'dc-xnor-canvas', 'XNOR', [
            [[0, 0], [1]],
            [[0, 1], [0]],
            [[1, 0], [0]],
            [[1, 1], [1]] ] );



    function createSRFlipFlopNor ( $container )
    {
        var ctx, elems = {}, w = 360, h = 200, truthTable, paths;

        ctx = createCanvas( $container, 'dc-sr-flip-flop-nor-canvas', w, h );

        elems.nor1 = new ve.NorGate( ctx, 140, 20 );
        elems.nor2 = new ve.NorGate( ctx );

        setRelativePos( elems.nor2, elems.nor1, 0, 100 );

        elems.r = createDummy( $container, ctx, 'R', elems.nor1, 'A', -DIST );
        elems.s = createDummy( $container, ctx, 'S', elems.nor2, 'B', -DIST );
        elems.q = createDummy( $container, ctx, 'Q', elems.nor1, 'Y' );
        elems.q_b = createDummy( $container, ctx, "Q'", elems.nor2, 'Y' );

        elems.nor1.Y.connect( elems.nor2.A );
        elems.nor2.Y.connect( elems.nor1.B );

        truthTable = [
            [[elems.s.Y, elems.r.Y], [elems.q.A, elems.q_b.A]],
            [['S', 'R'], ['Q', "Q'"]],
            [[0, 0], ['Q', "Q'"]],
            [[0, 1], [0, 1]],
            [[1, 0], [1, 0]],
            [[1, 1], ['X', 'X']]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.nor1.cn.B, ve.ALIGN_PIN_TURN, 20 );

        paths.setAlign( elems.nor1.cn.B, ve.ALIGN_MID, 6 );
        paths.setAlign( elems.nor2.cn.A, ve.ALIGN_MID, -6 );

        draw( elems, paths );

        elems.r.Y.$sw.click();
    }



    function createSRFlipFlopNand ( $container )
    {
        var ctx, elems = {}, w = 360, h = 200, truthTable, paths;

        ctx = createCanvas( $container, 'dc-sr-flip-flop-nand-canvas', w, h );

        elems.nand1 = new ve.NandGate( ctx, 140, 20 );
        elems.nand2 = new ve.NandGate( ctx );

        setRelativePos( elems.nand2, elems.nand1, 0, 100 );

        elems.r = createDummy( $container, ctx, "R'", elems.nand1, 'A', -DIST );
        elems.s = createDummy( $container, ctx, "S'", elems.nand2, 'B', -DIST );
        elems.q = createDummy( $container, ctx, 'Q', elems.nand1, 'Y' );
        elems.q_b = createDummy( $container, ctx, "Q'", elems.nand2, 'Y' );

        elems.nand1.Y.connect( elems.nand2.A );
        elems.nand2.Y.connect( elems.nand1.B );

        truthTable = [
            [[elems.s.Y, elems.r.Y], [elems.q.A, elems.q_b.A]],
            [["S'", "R'"], ['Q', "Q'"]],
            [[0, 0], ['X', 'X']],
            [[0, 1], [0, 1]],
            [[1, 0], [1, 0]],
            [[1, 1], ['Q', "Q'"]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.nand1.cn.B, ve.ALIGN_PIN_TURN, 20 );

        paths.setAlign( elems.nand1.cn.B, ve.ALIGN_MID, 6 );
        paths.setAlign( elems.nand2.cn.A, ve.ALIGN_MID, -6 );

        draw( elems, paths );

        elems.r.Y.$sw.click();
    }



    function createClockedSRFlipFlop ( $container )
    {
        var ctx, elems = {}, w = 460, h = 240, truthTable, paths;

        ctx = createCanvas( $container, 'dc-clocked-sr-flip-flop-canvas', w, h );

        elems.and1 = new ve.AndGate( ctx, 160, 20 );
        elems.and2 = new ve.AndGate( ctx );
        elems.nor1 = new ve.NorGate( ctx );
        elems.nor2 = new ve.NorGate( ctx );

        setRelativePos( elems.and2, elems.and1, 0, 140 );
        setRelativePos( elems.nor1.cn.A, elems.and1.cn.Y, 80 );
        setRelativePos( elems.nor2.cn.B, elems.and2.cn.Y, 80 );

        elems.r = createDummy( $container, ctx, 'R', elems.and1, 'A' );
        elems.e = createDummy( $container, ctx, 'E', elems.and1, 'B' );
        elems.s = createDummy( $container, ctx, 'S', elems.and2, 'B' );
        elems.q = createDummy( $container, ctx, 'Q', elems.nor1, 'Y' );
        elems.q_b = createDummy( $container, ctx, "Q'", elems.nor2, 'Y' );

        elems.e.x = elems.r.x;
        elems.e.y = ( elems.and1.cn.B.getY() + elems.and2.cn.A.getY() ) / 2;
        updateSwitchPos( $container, elems.e );

        elems.e.Y.connect( elems.and2.A );
        elems.and1.Y.connect( elems.nor1.A );
        elems.and2.Y.connect( elems.nor2.B );
        elems.nor1.Y.connect( elems.nor2.A );
        elems.nor2.Y.connect( elems.nor1.B );

        truthTable = [
            [[elems.e.Y, elems.s.Y, elems.r.Y], [elems.q.A, elems.q_b.A]],
            [['E', 'S', 'R'], ['Q', "Q'"]],
            [[0, 'X', 'X'], ['Q', "Q'"]],
            [[1, 0, 0], ['Q', "Q'"]],
            [[1, 0, 1], [0, 1]],
            [[1, 1, 0], [1, 0]],
            [[1, 1, 1], ['-', '-']]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.and2.cn.B, ve.ALIGN_PIN, 0 );

        paths.setAlign( elems.e.cn.Y, ve.ALIGN_PIN, 0 );

        paths.setAlign( elems.nor1.cn.B, ve.ALIGN_MID, 10 );
        paths.setAlign( elems.nor2.cn.A, ve.ALIGN_MID, -10 );

        paths.setAlign( elems.nor1.cn.B, ve.ALIGN_PIN_TURN, 20 );

        draw( elems, paths );

        elems.r.Y.$sw.click();
        elems.e.Y.$sw.click();
    }



    function createDFlipFlopNor ( $container )
    {
        var ctx, elems = {}, w = 460, h = 240, truthTable, paths;

        ctx = createCanvas( $container, 'dc-d-flip-flop-nor-canvas', w, h );

        elems.nand1 = new ve.NandGate( ctx, 140, 20 );
        elems.nand2 = new ve.NandGate( ctx );
        elems.nand3 = new ve.NandGate( ctx );
        elems.nand4 = new ve.NandGate( ctx );

        setRelativePos( elems.nand2, elems.nand1, 0, 140 );
        setRelativePos( elems.nand3.cn.A, elems.nand1.cn.Y, 80 );
        setRelativePos( elems.nand4.cn.B, elems.nand2.cn.Y, 80 );

        elems.d = createDummy( $container, ctx, 'D', elems.nand1, 'A', -DIST - 20 );
        elems.e = createDummy( $container, ctx, 'E', elems.nand2, 'B', -DIST - 20 );
        elems.q = createDummy( $container, ctx, 'Q', elems.nand3, 'Y' );
        elems.q_b = createDummy( $container, ctx, "Q'", elems.nand4, 'Y' );

        elems.nand1.B.connect( elems.e.Y );
        elems.nand1.Y.connect( elems.nand3.A );
        elems.nand1.Y.connect( elems.nand2.A );
        elems.nand2.Y.connect( elems.nand4.B );

        elems.nand3.Y.connect( elems.nand4.A );
        elems.nand4.Y.connect( elems.nand3.B );

        truthTable = [
            [[elems.e.Y, elems.d.Y], [elems.q.A, elems.q_b.A]],
            [['E', 'D'], ['Q', "Q'"]],
            [[0, 'X'], ['Q', "Q'"]],
            [[1, 0], [0, 1]],
            [[1, 1], [1, 0]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.nand1.cn.B, ve.ALIGN_PIN, 0 );

        paths.setAlign( elems.nand3.cn.B, ve.ALIGN_MID, 10 );
        paths.setAlign( elems.nand4.cn.A, ve.ALIGN_MID, -10 );

        paths.setAlign( elems.nand3.cn.A, ve.ALIGN_PIN_TURN, 40 );
        paths.setAlign( elems.nand3.cn.B, ve.ALIGN_PIN_TURN, 20 );

        draw( elems, paths );

        elems.e.Y.$sw.click();
    }



    function createDFlipFlopNand ( $container )
    {
        var ctx, elems = {}, w = 540, h = 240, truthTable, paths;

        ctx = createCanvas( $container, 'dc-d-flip-flop-nand-canvas', w, h );

        elems.not = new ve.Inverter( ctx, 160, 20 );
        elems.and1 = new ve.AndGate( ctx );
        elems.and2 = new ve.AndGate( ctx );
        elems.nor1 = new ve.NorGate( ctx );
        elems.nor2 = new ve.NorGate( ctx );

        setRelativePos( elems.and1.cn.A, elems.not.cn.Y, 40 );
        setRelativePos( elems.and2, elems.and1, 0, 140 );
        setRelativePos( elems.nor1.cn.A, elems.and1.cn.Y, 80 );
        setRelativePos( elems.nor2.cn.B, elems.and2.cn.Y, 80 );

        elems.d = createDummy( $container, ctx, 'D', elems.not, 'A', -DIST - 20 );
        elems.e = createDummy( $container, ctx, 'E', elems.and1, 'B', -DIST - 20 );
        elems.q = createDummy( $container, ctx, 'Q', elems.nor1, 'Y' );
        elems.q_b = createDummy( $container, ctx, "Q'", elems.nor2, 'Y' );

        elems.e.x = elems.d.x;
        elems.e.y = ( elems.and1.cn.B.getY() + elems.and2.cn.A.getY() ) / 2;
        updateSwitchPos( $container, elems.e );

        elems.not.Y.connect( elems.and1.A );
        elems.e.Y.connect( elems.and2.A );
        elems.d.Y.connect( elems.and2.B );
        elems.and1.Y.connect( elems.nor1.A );
        elems.and2.Y.connect( elems.nor2.B );
        elems.nor1.Y.connect( elems.nor2.A );
        elems.nor2.Y.connect( elems.nor1.B );

        truthTable = [
            [[elems.e.Y, elems.d.Y], [elems.q.A, elems.q_b.A]],
            [['E', 'D'], ['Q', "Q'"]],
            [[0, 'X'], ['Q', "Q'"]],
            [[1, 0], [0, 1]],
            [[1, 1], [1, 0]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.and2.cn.B, ve.ALIGN_PIN, 0 );

        paths.setAlign( elems.e.cn.Y, ve.ALIGN_PIN, 0 );

        paths.setAlign( elems.nor1.cn.B, ve.ALIGN_MID, 10 );
        paths.setAlign( elems.nor2.cn.A, ve.ALIGN_MID, -10 );

        paths.setAlign( elems.d.cn.Y, ve.ALIGN_PIN_TURN, 20 );

        paths.setAlign( elems.nor1.cn.B, ve.ALIGN_PIN_TURN, 20 );

        draw( elems, paths );

        elems.e.Y.$sw.click();
    }



    function createHalfAdder ( $container )
    {
        var ctx, elems = {}, w = 360, h = 180, truthTable, paths;

        ctx = createCanvas( $container, 'dc-half-adder-canvas', w, h );

        elems.xor = new ve.XorGate( ctx, 180, 20 );
        elems.and = new ve.AndGate( ctx );

        setRelativePos( elems.and, elems.xor, 0, 80 );

        elems.a = createDummy( $container, ctx, 'A', elems.xor, 'A', -DIST*2 );
        elems.b = createDummy( $container, ctx, 'B', elems.xor, 'B', -DIST*2 );
        elems.s = createDummy( $container, ctx, 'S', elems.xor, 'Y' );
        elems.c = createDummy( $container, ctx, 'C', elems.and, 'Y' );

        elems.a.Y.connect( elems.and.A );
        elems.b.Y.connect( elems.and.B );

        truthTable = [
            [[elems.a.Y, elems.b.Y], [elems.s.A, elems.c.A]],
            [['A', 'B'], ['S', 'C']],
            [[0, 0], [0, 0]],
            [[0, 1], [1, 0]],
            [[1, 0], [1, 0]],
            [[1, 1], [0, 1]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.a.cn.Y, ve.ALIGN_PIN_TURN, 20 );

        paths.setAlign( elems.and.cn.A, ve.ALIGN_PIN, 0 );
        paths.setAlign( elems.and.cn.B, ve.ALIGN_PIN, 0 );

        draw( elems, paths );
    }



    function createHalfAdder2 ( $container )
    {
        var ctx, elems = {}, w = 540, h = 220, truthTable, paths;

        ctx = createCanvas( $container, 'dc-half-adder2-canvas', w, h );

        elems.or   = new ve.OrGate( ctx, 180, 20 );
        elems.and1 = new ve.AndGate( ctx );
        elems.not  = new ve.Inverter( ctx );
        elems.and2 = new ve.AndGate( ctx );

        setRelativePos( elems.and1, elems.or, 0, 100 );
        setRelativePos( elems.not,  elems.or, 90, 50 );
        setRelativePos( elems.and2.cn.A, elems.or.cn.Y, 140 );

        elems.a = createDummy( $container, ctx, 'A', elems.or, 'A', -DIST*2 );
        elems.b = createDummy( $container, ctx, 'B', elems.and1, 'B', -DIST*2 + 12 );
        elems.s = createDummy( $container, ctx, 'S', elems.and2, 'Y' );
        elems.c = createDummy( $container, ctx, 'C', elems.and1, 'Y' );
        elems.c.x = elems.s.x;

        elems.a.Y.connect( elems.and1.A );
        elems.b.Y.connect( elems.or.B );

        elems.and2.A.connect( elems.or.Y );
        elems.and2.B.connect( elems.not.Y );

        elems.not.A.connect( elems.and1.Y );

        truthTable = [
            [[elems.a.Y, elems.b.Y], [elems.s.A, elems.c.A]],
            [['A', 'B'], ['S', 'C']],
            [[0, 0], [0, 0]],
            [[0, 1], [1, 0]],
            [[1, 0], [1, 0]],
            [[1, 1], [0, 1]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.and2.cn.B, ve.ALIGN_PIN, 0 );

        paths.setAlign( elems.a.cn.Y, ve.ALIGN_PIN, 0 );
        paths.setAlign( elems.or.cn.B, ve.ALIGN_PIN_TURN, 40 );
        paths.setAlign( elems.b.cn.Y, ve.ALIGN_PIN, 0 );

        draw( elems, paths );
    }



    function createFullAdder ( $container )
    {
        var ctx, elems = {}, w = 570, h = 160, truthTable, paths;

        ctx = createCanvas( $container, 'dc-full-adder-canvas', w, h );

        elems.ha1 = new HalfAdder( ctx, 150, 40 );
        elems.ha2 = new HalfAdder( ctx );
        elems.or = new ve.OrGate( ctx );

        setRelativePos( elems.ha2.cn.A, elems.ha1.cn.S, 60 );
        setRelativePos( elems.or.cn.A,  elems.ha1.cn.C, 200 );

        elems.a = createDummy( $container, ctx, 'A', elems.ha1, 'A' );
        elems.b = createDummy( $container, ctx, 'B', elems.ha1, 'B' );
        elems.cin = createDummy( $container, ctx, 'Cin', elems.ha2, 'B' );
        elems.s = createDummy( $container, ctx, 'S', elems.ha2, 'S' );
        elems.cout = createDummy( $container, ctx, 'Cout', elems.or, 'Y' );

        elems.s.x = elems.cout.x;

        elems.cin.x = elems.b.x;
        updateSwitchPos( $container, elems.cin );

        elems.ha1.S.connect( elems.ha2.A );
        elems.ha1.C.connect( elems.or.A );
        elems.ha2.C.connect( elems.or.B );

        truthTable = [
            [[elems.a.Y, elems.b.Y, elems.cin.Y], [elems.cout.A, elems.s.A]],
            [['A', 'B', 'Cin'], ['Cout', 'S']],
            [[0, 0, 0], [0, 0]],
            [[1, 0, 0], [0, 1]],
            [[0, 1, 0], [0, 1]],
            [[1, 1, 0], [1, 0]],
            [[0, 0, 1], [0, 1]],
            [[1, 0, 1], [1, 0]],
            [[0, 1, 1], [1, 0]],
            [[1, 1, 1], [1, 1]]
        ];

        createTruthTable( $container, truthTable );

        paths = ve.createAutoPath( ctx, elems );

        paths.setAlign( elems.ha1.cn.S, ve.ALIGN_PIN, 0 );
        paths.setAlign( elems.s.cn.A, ve.ALIGN_PIN, 0 );
        paths.setAlign( elems.ha2.cn.C, ve.ALIGN_PIN, 0 );

        draw( elems, paths );

        ve.drawLabel( ctx, 'Half Adder', elems.ha1 );
        ve.drawLabel( ctx, 'Half Adder', elems.ha2, ve.T_DOWN );
    }



    return {
        createAndGate: createAndGate,
        createOrGate: createOrGate,
        createNotGate: createNotGate,
        createNandGate: createNandGate,
        createNorGate: createNorGate,
        createXorGate: createXorGate,
        createXnorGate: createXnorGate,
        createSRFlipFlopNor: createSRFlipFlopNor,
        createSRFlipFlopNand: createSRFlipFlopNand,
        createClockedSRFlipFlop: createClockedSRFlipFlop,
        createDFlipFlopNor: createDFlipFlopNor,
        createDFlipFlopNand: createDFlipFlopNand,
        createHalfAdder: createHalfAdder,
        createHalfAdder2: createHalfAdder2,
        createFullAdder: createFullAdder
    };
}());
