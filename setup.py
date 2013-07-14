#!/usr/bin/env python
#=======================================================================

__version__ = '''0.1.12'''
__sub_version__ = '''20130714220348'''
__copyright__ = '''(c) Alex A. Naanou 2003'''


#-----------------------------------------------------------------------
##__long_doc__ = file('README.rst').read()
__long_doc__ = ''''''
##__doc__ = __long_doc__.split('\n\n', 1)[0]
__doc__ = ''''''

##print __doc__

#-----------------------------------------------------------------------
__classifiers__ = '''\
Development Status :: 3 - Alpha
Topic :: Utilities
License :: OSI Approved :: BSD License
Natural Language :: English
Programming Language :: Python
Environment :: Console
'''

#-----------------------------------------------------------------------
from setuptools import setup
import os.path as os_path
import sys, warnings

try:
	import py2exe
except:
	warnings.warn('can\'t import py2exe, without it building standalone versions is not supported.')

import buildcache
__pkg_version__ = buildcache.__version__

license = 'BSD Licence.'

##INCLUDE_GPL_LIBS_IN_EXE = False
INCLUDE_GPL_LIBS_IN_EXE = True


#-----------------------------------------------------------------------
setup(
	name = 'buildcache',
	version = __pkg_version__,
	description = __doc__,
	long_description = __long_doc__,
	author = 'Alex A. Naanou',
	author_email = 'alex.nanou@gmail.com',
	url = 'https://github.com/flynx/ImageGrid',
	license = license,
	platforms = ['any'],
	classifiers = filter(None, __classifiers__.split("\n")),

	install_requires = ['pli'],

	##!!! this needs to be done...
##	dependency_links = [],

	include_package_data = True,

	packages = [],
	py_modules = ['buildcache'],

	entry_points = {
		'console_scripts': [
			'buildcache = buildcache:handle_commandline'
		],
	},
	
	# py2exe stuff...
	options = {"py2exe": {
					'compressed': 1,
##					'optimize': 2,
					'bundle_files': 2,
##					'packages': 'encodings',
					'excludes': [] if INCLUDE_GPL_LIBS_IN_EXE else [
						# NOTE: we do not want to distribute any incompatible-licensed code...
						'pyexiv2',
					]
					}},
	console = ['buildcache.py'],
	)



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
