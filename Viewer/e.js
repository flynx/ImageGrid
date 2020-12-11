#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.Viewer Electron entry point...
*
*
* NOTE: this is kept as simple as possible to speed up initial loading.
*
**********************************************************************/

//require('v8-compile-cache')

var electron = require('electron')

var path = require('path')
var url = require('url')

var VERSION = require('./version').version


//---------------------------------------------------------------------

var app = electron.app
var BrowserWindow = electron.BrowserWindow



/*********************************************************************/

var win

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

// XXX get initial settings from config...
// XXX unify index.html and electron.html
function createWindow(){
	// Create the browser window.
	win = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
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
	win.setMenu(null)
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		//pathname: path.join(__dirname, 'electron.html'),
		protocol: 'file:',
		slashes: true
	}))
	// XXX HACK: pass this in a formal way... (???)
	win.once('ready-to-show', 
		function(){ global.readyToShow = true })
	win.on('closed', 
		function(){ win = null })

	// devtools for different windows...
	//win.webContents.openDevTools()
	//win.openDevTools()

	return win }



//---------------------------------------------------------------------

// This will be called when Electron has finished initialization and is 
// ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
	createSplash()
	createWindow() })

// Quit when all windows are closed.
// On macOS it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
app.on('window-all-closed', function(){
	process.platform !== 'darwin'
		&& app.quit() })

// On macOS it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
// XXX needs testing...
app.on('activate', function(){
	win === null
		&& createWindow() })




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
