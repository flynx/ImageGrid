#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.Viewer Electron entry point...
*
*
**********************************************************************/

//require('v8-compile-cache')

var electron = require('electron')
var app = electron.app
var BrowserWindow = electron.BrowserWindow

var path = require('path')
var url = require('url')
//var fs = require('fs')

var argv = require('ig-argv')

var VERSION = require('./version').version


//---------------------------------------------------------------------

//require('./cfg/requirejs')

//var _require = require
//require = requirejs


/*********************************************************************/

// XXX process args...
// 		...might be a good idea to process args in two stages:
// 		1) process pre-start args:
// 			splash screen opts
// 			debug stuff (dev tools etc)
// 			start mode (ui vs cli ...)
// 		2) process the rest of the args within the started context...



/*********************************************************************/

var win

// XXX move this to splash.js (or an electron-specific variant of it) 
// 		and use both here and in app.js...
// 		...another way would be to make this module importable...
function createSplash(){
	// NOTE: this is done here as this does not depend on code loading, 
	// 		thus showing the splash significantly faster...
	// XXX also show load progress here...
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
		// XXX unify this with index.html
		//pathname: path.join(__dirname, 'index.html'),
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
	return splash
}

function createWindow(){
	// Create the browser window.
	win = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
		},

		// let the window to get ready before we show it to the user...
		show: false,

		// XXX get from config... (???)
		// XXX for some reason this shows as black...
		backgroundColor: '#333333',


		width: 800, 
		height: 600,

		fullscreenable: true,

		//autoHideMenuBar: true,
	})
	// disable default menu...
	win.setMenu(null)

	//win.openDevTools()


	// and load the index.html of the app.
	win.loadURL(url.format({
		// XXX unify this with index.html
		//pathname: path.join(__dirname, 'index.html'),
		pathname: path.join(__dirname, 'electron.html'),
		protocol: 'file:',
		slashes: true
	}))

	// XXX HACK: pass this in a formal way...
	win.once('ready-to-show', function(){
		global.readyToShow = true
	})

	// Open the DevTools.
	//win.webContents.openDevTools()

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null
	})


	return win
}



//---------------------------------------------------------------------

// This will be called when Electron has finished initialization and is 
// ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
	createSplash()
	createWindow()
})

// Quit when all windows are closed.
// On macOS it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
app.on('window-all-closed', function(){
	process.platform !== 'darwin'
		&& app.quit()
})

// On macOS it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
// XXX needs testing...
app.on('activate', function(){
	win === null
		&& createWindow()
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
