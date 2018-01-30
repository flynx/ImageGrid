#!/usr/bin/env node
/**********************************************************************
* 
* ImageGrid.Viewer Electron entry point...
*
*
**********************************************************************/

var electron = require('electron')
var app = electron.app
var BrowserWindow = electron.BrowserWindow

var path = require('path')
var url = require('url')


//---------------------------------------------------------------------

//require('./cfg/requirejs')

//var _require = require
//require = requirejs


/*********************************************************************/

var win


function createWindow(){
	// Create the browser window.
	win = new BrowserWindow({
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

	// and load the index.html of the app.
	win.loadURL(url.format({
		// XXX unify this with index.html
		//pathname: path.join(__dirname, 'electron.html'),
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))

	// Open the DevTools.
	//win.webContents.openDevTools()

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null
	})
}



//---------------------------------------------------------------------

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	process.platform !== 'darwin'
		&& app.quit()
})

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	win === null
		&& createWindow()
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
