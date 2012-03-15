#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120315152600'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import json
import zipfile

import pli.pattern.mixin.mapping as mapping
import pli.objutils as objutils


#-----------------------------------------------------------------------
# XXX is this a good way to serialize the actual data in the fs???

#----------------------------------------------------------------dump---
# NOTE: these will work with any topoloy and create a flat index...
# XXX should this know anything about data versions???
def dump(index, path, index_depth=1, ext='.json'):
	'''
	store an index in fs store.

	by default the structure is as follows:

		key: abcdefg
		path: ab/abcdefg	(index_depth=1)


	index_depth sets the directory structure, if 0 a flat store is 
	created. here is an example path for index_depth=2

		path: ab/cd/abcdefg

	the dict value is stored in the file in JSON format.

	NOTE: this can be used with parts of a dict.
	NOTE: existing data will be overwritten.
	NOTE: store balancing depends on key structure.
	NOTE: index_depth with value greater than 2 is likely an overkill.
	'''
	root_index = {}
	for k, v in index.items():
		if index_depth > 0:
			d = []
			rest = k
			# build index path...
			for i in xrange(index_depth):
				d += [rest[:2]]
				rest = rest[2:]
				# recursive directory construction...
				if not os.path.exists(os.path.join(path, *d)):
					os.mkdir(os.path.join(path, *d))
			p = os.path.join(path, *d + [k + ext])
		else:
			p = os.path.join(path, k + ext)
		json.dump(v, file(p, 'w'), indent=4, separators=(', ', ': '))
		root_index[k] = p
	return root_index


#-----------------------------------------------------load_file_index---
def load(path, ext='.json', pack_ext='.pack'):
	'''
	load data from fs store.

	for data format see dump(...).

	NOTE: this will load the whole data set.
	NOTE: unpacked data shadows packed data.
	NOTE: this does not care about topology.
	'''
	d = {}
	for p, _, files in os.walk(path):
		for f in files:
			# handle single files...
			if f.endswith(ext):
				d[os.path.splitext(f)[0]] = json.load(file(os.path.join(p, f)))
			# handle packs...
			elif f.endswith(pack_ext):
				pack = zipfile.ZipFile(os.path.join(p, f))
				# load elements form the pack...
				for name in pack.namelist():
					if name.endswith(ext):
						d[os.path.splitext(name)[0]] = json.loads(pack.read(name))
	return d


#-----------------------------------------------------pack_file_index---
# XXX should we remove empty dirs here???
# XXX this will create duplicate files within the pack
# 	  only the last is accesible but this might cause trouble elsewhere...
# NOTE: this should be done in the background (possible race-condition
# 		with removing a file while it is being read)
def pack(path, ext='.json', pack_ext='.pack', keep_files=False, keep_dirs=False):
	'''
	pack an fs data store.

	NOTE: if keep_files is True, keep_dirs option will be ignored.
	'''
	##!!! this will not remove original entries if they exist...
	z = zipfile.ZipFile(os.path.join(path, 'index' + pack_ext), 'a', compression=zipfile.ZIP_DEFLATED)
	for p, _, files in os.walk(path):
		for f in files: 
			if f.endswith(ext):
				z.write(os.path.join(p, f), os.path.split(f)[-1])
				if not keep_files:
					os.remove(os.path.join(p, f))
					# XXX this will not remove empty dirs (push one
					#     level up for that...)
					if not keep_dirs and p != path:
						##!!! check if dir is empty....
						try:
							# NOTE: this will fail for non-empty dirs...
							os.rmdir(os.path.join(p))
						except:
							pass
	z.close()
	


#-----------------------------------------------------------------------
# lazy dict-like objects that read and write (optional) the fs...

#---------------------------------------------------------------Index---
# XXX might be good to do a path index...
##!!! make this archive/file structure-agnostic...
class Index(mapping.Mapping):
	'''
	'''
	__json_ext__ = '.json'
	__pack_ext__ = '.pack'
	__index_depth__ = 2

	def __init__(self, path):
		'''
		'''
		self._path = path
	
	# specific interface...
	##!!! make this support different depths...
	def __locations__(self, name):
		'''
		'''
		ext = self.__json_ext__
		name += ext
		# build probable locations...
		return (
				name,
				# look in a directory...
				os.path.join(name[:2], name),
				##!!! HACK: make this dynamic...
				os.path.join(name[:2], name[2:4], name),
		)
	
	# mapping interface...
	def __getitem__(self, name):
		'''
		'''
##		ext = self.__json_ext__
		pack_ext = self.__pack_ext__
##		file_name = name + ext
		locations = self.__locations__(name)
		# look of the file directly...
		for n in locations:
			if os.path.exists(os.path.join(self._path, n)):
				return json.load(file(os.path.join(self._path, n)))
		# try and locate a file in a pack...
		for p, _, files in os.walk(self._path):
			# files are searched sorted by their name...
			files.sort()
			for f in files:
##				##!!! do we need to look in odd named directories...
##				if f == file_name:
##					return json.load(file(os.path.join(p, file_name)))
				if f.endswith(pack_ext):
					z = zipfile.ZipFile(os.path.join(p, f))
					for n in locations:
						if n in z.namelist():
							return json.loads(z.read(n))
		raise KeyError, name
	def __setitem__(self, name, value):
		'''
		'''
		dump({name: value}, self._path, index_depth=self.__index_depth__)
	def __delitem__(self, name):
		'''
		'''
		raise NotImplementedError
	def __iter__(self):
		'''
		'''
		visited = []
		packs = []
		ext = self.__json_ext__
		pack_ext = self.__pack_ext__
		for p, _, files in os.walk(self._path):
			for f in files:
				if f.endswith(ext) and f not in visited:
					visited += [f]
					yield os.path.splitext(f)[0]
				elif f.endswith(pack_ext):
					packs += [os.path.join(p, f)]
		for pack in packs:
			z = zipfile.ZipFile(pack)
			for name in z.namelist():
				if name not in visited:
					visited += [name]
					yield os.path.splitext(name)[0]



#-----------------------------------------------------------------------
REMOVED = object()

#------------------------------------------------------IndexWithCache---
class IndexWithCache(Index):
	'''
	'''
	objutils.createonaccess('_cache', dict)

	__sync__ = False

	def __getitem__(self, name):
		'''
		'''
		if name in self._cache:
			res = self._cache[name]
			if res is REMOVED:
				raise KeyError, name
			return res
		res = self._cache[name] = super(IndexWithCache, self).__getitem__(name)
		return res
	def __setitem__(self, name, value):
		'''
		'''
		self._cache[name] = value
		if self.__sync__:
			self.cache_flush(name)
	##!!!
	def __delitem__(self, name):
		'''
		'''
		self._cache[name] = REMOVED
		if self.__sync__:
			self.cache_flush(name)
	def __iter__(self):
		'''
		'''
		cache = self._cache
		for e in cache:
			yield e
		for e in super(IndexWithCache, self).__iter__():
			if e not in cache:
				yield e
	
	# cache management...
	##!!! removed items will not get flushed yet...
	# XXX to make removing elements history compatible, one way to go
	#     is to write a specifc value to the file, thus making it
	#     shadow the original value...
	def cache_flush(self, *keys):
		'''
		'''
		if keys == ():
			return dump(self._cache, self._path, index_depth=self.__index_depth__)
		flush = {}
		for k in keys:
			if k is REMOVED:
				# remove file...
##				raise NotImplementedError
				##!!!
				continue
			flush[k] = self[k]
		return dump(flush, self._path, index_depth=self.__index_depth__)
	def cache_drop(self):
		'''
		'''
		del self._cache



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
