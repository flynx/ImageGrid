var keybindings = {
	//72: 	toggleHelp,										//	???
	70:		toggleSingleImageMode,							//	f
	13:		70,												//	Enter
	84:		toggleSingleImageModeTransitions,				//	t
	65:		toggleTransitions,								//	a
	66:		toggleBackgroundModes,							//	b
	9:		toggleControls,									//	tab
	77:		toggleMarkers,									//	m

	// zooming...
	187:	function(){scaleContainerBy(ZOOM_FACTOR)},		//	+
	189:	function(){scaleContainerBy(1/ZOOM_FACTOR)},	//	-
	// zoom presets...
	48:	{
		'default':	fitImage,								// 	0
		'ctrl':		function(){setContainerScale(1)},		//	ctrl+0
	},
	51:		fitThreeImages,									//	3

	36:		firstImage,										//	Home
	35:		lastImage,										//	End

	37: 	prevImage,										// 	Left
	80: 	37, 											// 	BkSp
	188:	37, 											//	p
	8:		37,												//	<
	39:		nextImage,										//	Right
	32:		39,												//	Space
	190:	39,												//	m
	78: 	39,												//	>

	// these work with ctrl and shift modifiers...
	40:	{
		'default': focusBelowRibbon,						//	Down
		'shift': shiftImageDown,							//	shift-Down
		'ctrl+shift': function(){							//	ctrl-shift-Down
			createRibbon('next')
			shiftImageDown()
		}
	}, //	Down
	38: {
		'default': focusAboveRibbon,						//	Up
		'shift': shiftImageUp,								//	shift-Up
		'ctrl+shift': function(){							//	ctrl-shift-Up
			createRibbon('prev')
			shiftImageUp()
		}
	},

	// XXX should these be s-up, s-down, ... ??
	75:		moveViewUp,										//	k
	74:		moveViewDown,									//	j
	72:		moveViewLeft,									//	h
	76:		moveViewRight,									//	l

	79:		centerCurrentImage,								//	o

	
	// ignore the modifiers...
	16:		function(){},
	17:		16,
	18:		16,
}
/*
	close: [27, 88, 67],						//	???

	// these work with ctrl modifier...
	promote: [45],								//	???
	demote: [46],								//	???


	// print unhandled keys...
	helpShowOnUnknownKey: true
*/

// vim:set ts=4 sw=4 nowrap :
