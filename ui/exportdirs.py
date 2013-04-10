#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130410162136'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import shutil
import json
import urllib2

from pprint import pprint



#-----------------------------------------------------------------------
#----------------------------------------------------------build_dirs---
def build_dirs(data, path, rewrite=None):
	'''
	rewrite can be:
		'force'		- allways rewrite a destination file.
		'older'		- rewrite only older files.
		None		- never rewrite.
	'''
	ribbons = data['ribbons']

	depth = len(ribbons)
	fav_path = os.path.join(path, *(['fav'] * depth))

	if not os.path.exists(fav_path):
		os.makedirs(fav_path)

	err_urls = []

	for i, ribbon in enumerate(ribbons):
		level_path = os.path.join(path, *(['fav'] * (depth - i)))

		for guid, image in ribbon.items():
			try:
				# XXX for some magical reason this works and url2pathname does not...
				##!!! this will also break on utf paths...
				img = urllib2.urlopen(image['path'])
				p = img.fp.name
				img.close()

				# XXX do we need to indicate overwriting in the status?
				if rewrite == 'force' or not os.path.exists(os.path.join(level_path, os.path.split(p)[-1])):
					shutil.copy(p, level_path)
					yield 'written', level_path, image
				elif rewrite == 'older':
					raise NotImplementedError
					##!!! check dates...
					##!!!
					yield 'written', level_path, image
				else:
					yield 'skipped', level_path, image

			except urllib2.URLError:
				yield 'err', level_path, image



#-----------------------------------------------------------------------
if __name__ == '__main__':
	from optparse import OptionParser

	parser = OptionParser()

	##!!! need to define the path so that it shoes up in -h

	options, args = parser.parse_args()

	# settings...
	##!!! make this configurable...

	if len(args) != 2:
		parser.print_usage()

	else:
		data, path = args[0], args[1]

		path = path.replace('\\', '/')
		data = json.load(file(data, 'r'))
		err_urls = []
		cur_p = None

		for status, p, img in build_dirs(data, path):
			if cur_p != p:
				cur_p = p
				print
				print 'Level:', p
			if status == 'written':
				print '.',
			elif status == 'skipped':
				print '-',
			elif status == 'err':
				print 'x',
				err_urls += [img['path']]
		print

		if len(err_urls) != 0:
			print 'Could not open %s files:' % len(err_urls)
			pprint(err_urls)




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
