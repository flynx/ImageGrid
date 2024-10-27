#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.Viewer Electron entry point...
*
*
* NOTE: this is kept as simple as possible to speed up initial loading.
*
**********************************************************************/

// Global scope pollution test...
if(process.env.IMAGEGRID_DEBUG){
	global.__global = {...global}
	global.scopeDiff = function(cur=global, base=__global){
		return Object.keys(cur)
			.filter(function(k){ return base[k] !== cur[k] })
			.reduce(function(res, k){
				res[k] = cur[k]
				return res }, {})} }


/*********************************************************************/

//require('v8-compile-cache')

var electron = require('electron')
var path = require('path')
var url = require('url')

var VERSION = require('./version').version



//---------------------------------------------------------------------

var app = electron.app
var BrowserWindow = electron.BrowserWindow
var ipcMain = electron.ipcMain

// 
global.ELECTRON_PACKAGED = app.isPackaged

// used to let e.js know that the CLI wants to start the GUI..
global.START_GUI = false




/*********************************************************************/
// XXX do we need multiwindow support???


// Splash window...
//
// XXX might be nice to show load progress on splash...
var SPLASH
var SPLASH_TIMEOUT = 20 * 1000
function createSplash(force=false){
	// singleton window...
	if(!force && SPLASH){
		return SPLASH }

	// NOTE: this is done here as this does not depend on code loading, 
	// 		thus showing the splash significantly faster...
	SPLASH = new BrowserWindow({
		// let the window to get ready before we show it to the user...
		show: false,

		transparent: true,
		frame: false,
		center: true,
		width: 840, 
		height: 540,

		alwaysOnTop: true,

		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,

		autoHideMenuBar: true,
	})
	SPLASH.loadURL(url.format({
		pathname: path.join(__dirname, 'splash.html'),
		protocol: 'file:',
		slashes: true
	}))
	SPLASH.once('ready-to-show', function(){
		this.webContents
			// see if the splash screen is disabled...
			.executeJavaScript('localStorage.disableSplashScreen')
				.then(function(disabled){
					// update version...
					disabled
						|| SPLASH.webContents
							.executeJavaScript(
								`document.getElementById("version").innerText = "${VERSION}"`)
					// show/destroy..
					disabled ?
						SPLASH.destroy()
						: SPLASH.show() }) })
	SPLASH.on('closed', 
		function(){ 
			SPLASH = null 
			WIN
				&& WIN.webContents.executeJavaScript('document.appSplashScreen = false') })

	// handle main window state...
	WIN
		&& WIN.webContents.executeJavaScript('document.appSplashScreen = true')

	// auto-close splash...
	SPLASH_TIMEOUT
		&& setTimeout(
			function(){
				SPLASH 
					&& SPLASH.destroy() }, 
			SPLASH_TIMEOUT)

	return SPLASH }


// Create main window...
//
// NOTE: initial window metrics are loaded by the app feature...
// 		XXX should this be done here???
//
// XXX handle maximize corretly...
// 		...currently it does not differ visually from fullscreen -- either
// 		make them the same or keep them separate visually...
var WIN
function createWindow(force=false){
	// singleton window...
	if(!force && WIN){
		return WIN }

	// Create the browser window.
	WIN = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			nodeIntegrationInWorker: true,
			contextIsolation: false,
			enableRemoteModule: true,
		},

		// let the window get ready before we show it to the user...
		show: false,
		frame: false,

		backgroundColor: '#333333',

		width: 800, 
		height: 600,

		fullscreenable: true,

		// XXX not sure about this...
		//maximizable: false,

		//autoHideMenuBar: true,
	})
	// disable default menu...
	WIN.setMenu(null)
	WIN.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true,
	}))

	WIN.once('ready-to-show', 
		function(){ 
			WIN.webContents.executeJavaScript(`
				document.readyToShow = true 

				// XXX make these a prop...
				document.appFullScreen = false
				document.appDevTools = false
			`) 
			// splash screen...
			WIN.webContents.executeJavaScript(
				SPLASH ?
					'document.appSplashScreen = true'
					: 'document.appSplashScreen = false') })
	WIN.on('closed', 
		function(){ WIN = null })

	// devtools...
	WIN.webContents.on('devtools-opened', 
		function(){
			WIN && WIN.webContents.executeJavaScript('document.appDevTools = true') })
	WIN.webContents.on('devtools-closed', 
		function(){
			WIN && WIN.webContents.executeJavaScript('document.appDevTools = false') })

	// handle env...
	// devtools for different windows...
	process.env.IMAGEGRID_DEBUG
		&& WIN.openDevTools({mode: 'undocked'})
	// Force show window...
	process.env.IMAGEGRID_FORCE_SHOW
		&& WIN.show()

	return WIN }



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// Start the app...
//
function start(){
	var _start = function(){
		createSplash()
		createWindow() }
	// NOTE: by this time (arg parsing and stuff) the app may already 
	//		be ready...
	app.isReady() ?
		_start()
		: app.on('ready', _start) }



//---------------------------------------------------------------------
// Event handlers...

// Window states...
ipcMain.on('show', 
	function(){ WIN && WIN.show() })
ipcMain.on('hide', 
	function(){ WIN && WIN.hide() })

ipcMain.on('minimize', 
	function(){ WIN && WIN.minimize() })

ipcMain.on('enterFullScreen', 
	function(){ 
		if(WIN){
			WIN.setFullScreen(true) 
			WIN.webContents.executeJavaScript('document.appFullScreen = true') } })
ipcMain.on('exitFullScreen', 
	function(){ 
		if(WIN){
			WIN.setFullScreen(false)
			WIN.webContents.executeJavaScript('document.appFullScreen = false') } })

// Splash screen...
ipcMain.on('openSplashScreen', 
	function(){ 
		SPLASH 
			|| createSplash() })
ipcMain.on('closeSplashScreen', 
	function(){ 
		// force this to run after this frame avoiding races...
		setTimeout(
			function(){ 
				SPLASH 
					&& SPLASH.destroy() }, 
			10) })

// DevTools...
// XXX need to focus devtools here...
// 		see: webContents.getAllWebContents()
ipcMain.on('openDevTools', 
	function(){ 
		WIN
			&& WIN.openDevTools({
				mode: 'undocked',
				activate: true,
			}) })
ipcMain.on('closeDevTools', 
	function(){ WIN && WIN.closeDevTools() })



//---------------------------------------------------------------------
// Event handlers (macOS)...

// On macOS it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
// XXX test...
app.on('activate', function(){
	WIN || createWindow() }) 

// Quit when all windows are closed.
// On macOS it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
app.on('window-all-closed', function(){
	process.platform !== 'darwin'
		&& app.quit() })



//---------------------------------------------------------------------
// start things up...

;(ELECTRON_PACKAGED ? 
		process.argv.length > 1 
		: process.argv.length > 2) ?
	// got some arguments -- delegate to ig.js...
	(require('./ig') 
		&& global.START_GUI 
		&& start())
	// start the viewer...
	: start()




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
