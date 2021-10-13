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

// 
global.ELECTRON_PACKAGED = app.isPackaged

// used to let e.js know that the CLI wants to start the GUI..
global.START_GUI = false




/*********************************************************************/


// Splash window...
//
// XXX might be nice to show load progress on splash...
function createSplash(){
	// NOTE: this is done here as this does not depend on code loading, 
	// 		thus showing the splash significantly faster...
	var splash = global.splash = new BrowserWindow({
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
	splash.loadURL(url.format({
		pathname: path.join(__dirname, 'splash.html'),
		protocol: 'file:',
		slashes: true
	}))
	splash.once('ready-to-show', function(){
		this.webContents
			// see if the splash screen is disabled...
			.executeJavaScript('localStorage.disableSplashScreen')
			.then(function(disabled){
				// update version...
				disabled
					|| splash.webContents
						.executeJavaScript(
							`document.getElementById("version").innerText = "${VERSION}"`)
				// show/destroy..
				disabled ?
					splash.destroy()
					: splash.show() }) })
	return splash }


// Create main window...
//
// XXX get initial settings from config...
var WIN
function createWindow(){
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

		backgroundColor: '#333333',

		width: 800, 
		height: 600,

		fullscreenable: true,

		//autoHideMenuBar: true,
	})
	// disable default menu...
	WIN.setMenu(null)
	WIN.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true,
	}))
	// XXX HACK: pass this in a formal way... (???)
	WIN.once('ready-to-show', 
		function(){ global.readyToShow = true })
	WIN.on('closed', 
		function(){ WIN = null })

	// devtools for different windows...
	process.env.IMAGEGRID_DEBUG
		&& WIN.openDevTools({mode: 'undocked'})
	//WIN.webContents.openDevTools({mode: 'undocked'})

	return WIN }


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

// On macOS it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
app.on('activate', function(){
	WIN === null
		&& createWindow() }) 

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
