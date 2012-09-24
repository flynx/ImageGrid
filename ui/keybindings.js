/*********************************************************************/
// NOTE: use String.fromCharCode(code)...
// list of keys to be ignored by handler but still handled by the browser...

var keybindings = {
	// global bindings...
	'*': {
		title: 'Global',
		doc: '',

		ignore: [
			116,												//	F5
			123,												//	F12
		],

		// togglable modes and options...
		191: {
			'default':	ImageGrid.showKeyboardBindings,			//	?
			'ctrl':		ImageGrid.showSetup,					//	ctrl+?
		},
		80:		ImageGrid.showSetup,							//	p
		70:		ImageGrid.toggleSingleImageMode,				//	f
		13:		70,												//	Enter
		83:		ImageGrid.toggleSingleRibbonMode,				//	s
		84:		ImageGrid.toggleSingleImageModeTransitions,		//	t
		65:		ImageGrid.toggleTransitions,					//	a
		9:		ImageGrid.toggleControls,						//	tab
		66:		ImageGrid.toggleBackgroundModes,				//	b
		73:		ImageGrid.toggleCurrentRibbonOpacity,			//	i
		78:		ImageGrid.toggleInfo,							//	n
		77:		toggleMarkers,									//	m

		87:		ImageGrid.saveState,							//	w

		27:		ImageGrid.closeOverlay,							//	Esc	

		// ignore the modifiers (shift, alt, ctrl, caps)...
		16:		function(){},
		17:		16,
		18:		16,
		20:		16,												//	Caps Lock

		// refresh...
		// XXX make this into a real action...
		116:	function(){ return DEBUG?true:false },			//	F5
		112:	116,											//	F12
	},


	// overlay...
	'.overlay-mode': {
		title: 'Overlay mode',
		doc: 'Overlay mode key bindings.',

		ignore: [
			33,													//	PgUp
			34,													//	PgDown
			37,													//	Left
			39,													//	Right
			36,													//	Home
			32,													//	Space
			35,													//	End
			38,													//	Up
			40,													//	Down
		],
	},


	// everything except overlays...
	'.viewer *:not(.overlay-mode *)': {
		title: 'Ribbon and Viewer',
		doc: '',

		// zooming...
		187:	ImageGrid.scaleContainerUp,						//	+
		189:	ImageGrid.scaleContainerDown,					//	-
		// zoom presets...
		48:	{
			'default':	ImageGrid.centerCurrentImage,			// 	0
			// XXX make this into a real action...
			'ctrl':		ImageGrid.fitImage,						//	ctrl+0
		},
		49:		ImageGrid.fitImage,								//	1
		50:		ImageGrid.fitTwoImages,							//	2
		51:		ImageGrid.fitThreeImages,						//	3
		52:		ImageGrid.fitFourImages,						//	4
		53:		ImageGrid.fitFiveImages,						//	5
		54:		ImageGrid.fitSixImages,							//	6
		55:		ImageGrid.fitSevenImages,						//	7
		56:		ImageGrid.fitEightImages,						//	8
		57:		ImageGrid.fitNineImages,						//	9


		// navigation...
		36:		ImageGrid.firstImage,							//	Home
		219:	36,												//	[
		35:		ImageGrid.lastImage,							//	End
		221:	35,												//	]
		37:	{
			'default': ImageGrid.prevImage,						//	Right
			'ctrl': ImageGrid.prevScreenImages,					//	ctrl-Right
			'alt': ImageGrid.prevScreenImages,					//	alt-Right
		},
		8: 		37, 											// 	BkSp
		188:	37,												//	<
		39:	{
			'default': ImageGrid.nextImage,						//	Left
			'ctrl': ImageGrid.nextScreenImages,					//	ctrl-Left
			'alt': ImageGrid.nextScreenImages,					//	alt-Left
		},
		32:		39,												//	Space
		190:	39,												//	>
		186:	ImageGrid.prevScreenImages,						//	;
		222:	ImageGrid.nextScreenImages,						//	'
		// move view...
		// XXX should these be s-up, s-down, ... ??
		75:		ImageGrid.moveViewUp,							//	k
		74:		ImageGrid.moveViewDown,							//	j
		72:		ImageGrid.moveViewLeft,							//	h
		76:		ImageGrid.moveViewRight,						//	l
		// XXX use this to open...
		//79:		ImageGrid.centerCurrentImage,					//	o


		// combined navigation with actions..
		38: {
			'default': ImageGrid.focusAboveRibbon,				//	Up
			'shift': ImageGrid.shiftImageUp,					//	shift-Up
			'ctrl+shift': ImageGrid.shiftImageUpNewRibbon		//	ctrl-shift-Up
		},
		40:	{
			'default': ImageGrid.focusBelowRibbon,				//	Down
			'shift': ImageGrid.shiftImageDown,					//	shift-Down
			'ctrl+shift': ImageGrid.shiftImageDownNewRibbon		//	ctrl-shift-Down
		},

		// misc actions...
		82:		ImageGrid.reverseImageOrder,					//	r
	}
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
