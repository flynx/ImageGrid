/**********************************************************************
* 
*
*
**********************************************************************/

const puppeteer = require('puppeteer')



/*********************************************************************/

;(async () => {
	var browser = await puppeteer.launch()
	var page = await browser.newPage()
	page.on('console', msg => console.log('  |', msg.text()))

	await page
		.goto('file://'+ process.cwd().replace(/[\\\/]/g, '/') +'/../index.html')


	// Util functions...
	//
	// screenshot...
	page.exposeFunction('screenshot', 
		async function(name){
			return page.screenshot({path: name || 'screenshot.png'}) })
	// exit...
	page.exposeFunction('exit', 
		async function(name){
			return browser.close() })



	page.evaluate(() => 
		$('.viewer')
			.on('ig.ready', async () => {
				// XXX make this scriptable...
				ig.browseActions()
				await screenshot('browseActions.png')
				ig.modal.client.close()

				ig.browseActions('/File/')
				await screenshot('browseActions - File.png')
				ig.modal.client.close()

				await exit()
			}))

	//await page.screenshot({path: 'example.png'})
	//await browser.close()
})()




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
