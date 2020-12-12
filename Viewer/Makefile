#**********************************************************************
##
## ImageGrid.Viewer Makefile...
##
#
# Make dependencies that need to be installed (make check):
# 	- make basics
# 		- bash
# 		- sed
# 		- grep / fgrep / egrep
# 		- printf
# 	- General
#	 	- git
# 		- nodejs / npm / npx
# 			also nodejs-legacy seems to be required in some 
# 			contexts...
# 		- wget
# 		- zip / unzip / zipnote
# 			if zipnote fails this is likely due to a bug in 
# 			v3.0, to fix this by either upgrading to 3.1 or 
# 			a patched version of 3.0...
# 			for more info and patch see: 
# 				https://goo.gl/csQmQo
# 	- Optional
# 		- npm i -g electron electron-rebuild asar less 
# 			needed only if running global versions of cli's,
# 			will be maintained and used by npm/npx 
# 			automatically in local ./node_modules...
# 	- Windows
# 		- MSVS -- to build native node modules (sharp) (optional?)
#	- Linux
#	- macOS
#	- iOS
# 	- Android
# 	- web
#
#
## To print full list of user make targets use:
## 	make help
##
##
## Variables to control the build:
## 	APP_NAME	- Application name
## 	APP_BIN		- App binary name (ignored for MacOS)
##
## 	ARCH		- target achitecture (ia32, x86, x64, ...)
## 	TARGET_OS	- target OS (win32, linux, darwin)
##
## 	ELECTRON_DOWNOAD_URL
## 			- URL to download electron binary
## 	ELECTRON_DIST	- electron distribution file name pattern
## 	BUILD_MODE	- can be "repack" or "in-place" (default)
##
## NOTE: when setting variables avoid using spaces and other characters 
## 	make can get fussy about...
## NOTE: to do a repack build call:
## 		(export BUILD_MODE=repack && make)
 # NOTE: in most cases we do not add a "/" to target dirs to destinguish 
 # 	them from target files except for one case:
 #		$(BUILD_DIR)/$(APP_NAME)-%/
 #	this will help make destinguish it from things like:
 #		$(DIST_DIR)/$(APP_NAME)-%.zip
## NOTE: cross compilation is at this time not supported, if you try it 
## 	and it works then 1) you got very lucky and 2) tell me about it =)
## 	...at least the node native packages (sharp) will likely either 
## 	fail or	will get compiled to the wrong arch and not be used and 
##	some non-native packages may misbehave (though I'm not aware of 
##	any at this point, so report them if you encounter one).
##	This is complicated by the fact that most of ImageGrid.Viewer is
##	platform-agnostic and will run on almost anything and will simply 
##	try to ignore broken packages and features depending on them, so
##	check the console log for any odd load reports...
##	...but note that cross-building and packaging is possible either
##	without the native modules or with them pre-built for the target
##	platform.
##
##
## Examples:
##	# check if all dependencies are available...
##	make check
##
##	# make development environment...
##	make dev
##
## 	# full build...
## 	make clean dist
##
##	# build in repack mode...
##	BUILD_MODE=repack make dist
##
## 	# build for darwin... (EXPERIMENTAL)
## 	TARGET_OS=darwin make clean dist
##
#
#
#----------------------------------------------------------------------
#
# ToDo:
# 	- sync version numbers between:
# 		- git tags (currently not used)
# 		- package.json
# 			can't use only this because it can't be imported 
# 			in browser directly...
# 			...do we actually need the file:// version working?
# 		- version.js
# 	- app icons...
# 	- add a cli-only build target...
# 	- installers:
# 		- msi (wix)
# 		- deb
# 		- rpm
# 		- ...
# 	- cross-compiling support (???)
# 	- cross-package with pre-built libs...
# 	- nwjs???
#
#
# Links:
# 	WiX example...
# 		https://helgeklein.com/blog/2014/09/real-world-example-wix-msi-application-installer/
# 	npm modules to abstract WiX...
# 		https://www.npmjs.com/package/electron-wix-msi
# 		https://www.npmjs.com/package/electron-builder
#
#
#
#**********************************************************************
# basic configuration...

.SECONDEXPANSION:

# XXX for some reason in some contexts bash complains somewhere after 
# 	this point but otherwise works fine:
# 		- ssh localhost
# 		- termux on android
# 	while everything is OK on ubuntu and normal dev context...
SHELL := $(shell which bash)

# set path to use local tools...
# NOTE this does not affect where make is seraching for commands...
# XXX this breaks which when looking for egrep/fgrep...
#export PATH := $(shell pwd)/node_modules/.bin/:$(PATH)



# variables...

APP_NAME ?= ImageGrid.Viewer


VERSION_FALLBACK ?= 4.0.0a
# NOTE: we are not using './ig --version 2> /dev/null' because it will 
# 	not work before we do 'npm install'...
VERSION := $(strip $(shell \
	echo 'console.log(require("./version").version)' | node - \
		|| echo $(VERSION_FALLBACK)))
DATE := $(strip $(shell date "+%Y%m%d%H%M"))
COMMIT := $(strip $(shell git rev-parse HEAD))

# less...
#
LESSC := npx lessc


# Electron...
#
# NOTE: Linux does not let an app run if some of the libs it is dynamically 
# 	linked against are missing, this can happen if we try to run electron
# 	on a non-GUI box (i.e. no gtk)...
# 	...love the "statically" linked "dynamic" libs...
# NOTE: I would rather use the $PATH but there seeems to be no way to 
# 	change the env make already sees except for two ways:
# 		1) wrap all the relevant commands in vars and use child 
# 		   procs to access their paths (as is done below)
# 		2) set path and launch a child make -- not sure how to 
# 		   do this...
ELECTRON := npx electron
# XXX stopped working while sharp started working out of the box...
ELECTRON_REBUILD := npx electron-rebuild
ASAR := npx asar
ELECTRON_VERSION_FALLBACK ?= v1.8.1
ELECTRON_VERSION := $(strip $(shell \
	$(ELECTRON) -v 2> /dev/null \
		|| echo $(ELECTRON_VERSION_FALLBACK)))
ELECTRON_DOWNOAD_URL ?= https://github.com/electron/electron/releases/download/$(ELECTRON_VERSION)
ELECTRON_DIST ?= electron-$(ELECTRON_VERSION)-$(TARGET_OS)-$(ARCH).zip


# NW...
#
# XXX get the version dynamically... (???)
NW_VERSION ?= v0.28.0
NW_DIST ?= nwjs-sdk-$(NW_VERSION)-$(NW_OS)-$(ARCH).zip
NW_DOWNOAD_URL ?= https://dl.nwjs.io/$(NW_VERSION)


BUILD_MODE ?= in-place


# OS-specific stuff...
ifeq ($(OS),Windows_NT)
	# NOTE: this is electron naming convention...
	TARGET_OS ?= win32
	NW_OS ?= win

	# set arch...
	ifeq ($(PROCESSOR_ARCHITEW6432),AMD64)
		ARCH ?= x64
	else
		ifeq ($(PROCESSOR_ARCHITECTURE),AMD64)
			ARCH ?= x64
		endif
		ifeq ($(PROCESSOR_ARCHITECTURE),x86)
			ARCH ?= ia32
		endif
	endif

else
	ifeq ($(shell uname -s),Linux)
		TARGET_OS ?= linux
		NW_OS ?= $(TARGET_OS)
	endif
	ifeq ($(shell uname -s),Darwin)
		TARGET_OS ?= darwin
		NW_OS ?= osx
	endif

	# set arch...
	ifeq ($(shell uname -m),x86_64)
		ARCH ?= x64
	endif
	ifneq ($(filter %86,$(shell uname -p)),)
		ARCH ?= ia32
	endif
endif


# setup path and file naming stuff...
ifeq ($(TARGET_OS),win32)
	APP_BIN ?= ig
	ELECTRON_BIN = electron
	ASAR_PATH = resources
	EXT = .exe
	DLLs = "$@/"*dll
endif
ifeq ($(TARGET_OS),linux)
	APP_BIN ?= ig
	ELECTRON_BIN = electron
	ASAR_PATH = resources
endif
ifeq ($(TARGET_OS),darwin)
	APP_BIN ?= $(APP_NAME)
	ELECTRON_BIN = Electron
	ASAR_PATH = Electron.app/Contents/Resources
	EXT = .app
endif



#----------------------------------------------------------------------
# Built-in make stuff...

# NOTE: some of the targets are directories so this will enable GNUMake's
# 	automatic cleanup to work.
# 	...not sure if this is the right way to go...
RM += -r

MD = @mkdir -p


#**********************************************************************
# Paths and lists...

TARGET_DIR = targets
DIST_DIR = dist
# NOTE: this can not contain spaces...
BUILD_DIR = build

NODE_DIR = node_modules
LIB_DIR = lib
EXT_LIB_DIR = ext-lib
CSS_DIR = css
CFG_DIR = cfg
DOMAIN_DIR = imagegrid
FEATURES_DIR = features
WORKERS_DIR = workers
IMAGES_DIR = images
ASSET_DIR := data

LICENSE = LICENSE
BUILD_INFO = $(BUILD_DIR)/INFO
PROJECT_FILES = package.json
# get all .css build targets, in addition, get all the .less files and 
# replace .less with .css making them build targets...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard css/*.less))
HTML_FILES := $(wildcard *.html)
ROOT_JS_FILES := $(wildcard *.js)
# NOTE: this is only used for make change/dependency tracking checking...
JS_FILES := $(ROOT_JS_FILES) \
	$(wildcard $(DOMAIN_DIR)/*.js) \
	$(wildcard $(FEATURES_DIR)/*.js) \
	$(wildcard $(WORKERS_DIR)/*.js) \
	$(wildcard $(LIB_DIR)/*.js) \
	$(wildcard $(LIB_DIR)/*/*.js) \
	$(wildcard $(EXT_LIB_DIR)/*.js)
DOC_FILES := doc/MAKE

INCLUDE_NODE_MODULES = \
	ig-object ig-actions ig-features ig-types ig-argv object-run \
	requirejs requirejs-plugins

INCLUDE_NW_NODE_MODULES = app-module-path



#**********************************************************************
# dependencies to check...
#
DEPENDENCIES_HELP = sed grep egrep fgrep printf 
DEPENDENCIES_WEB = node npm npx

DEPENDENCIES = $(DEPENDENCIES_WEB) \
	$(DEPENDENCIES_HELP) \
	wget zip unzip zipnote git



#**********************************************************************
# help generator...
#
# Help syntax:
# 	"## Normal help text..."
#
# 	"### Section title..."
# 	"##----- Section title ---"
#
.PHONY: help
help:
	@IFS=$$'\n' ; \
	help_lines=(`fgrep -h "##" $(MAKEFILE_LIST) \
		| fgrep -v fgrep \
		| fgrep -v '"##' \
		| sed -e 's/\\$$//'`); \
	for help_line in $${help_lines[@]}; do \
		IFS=$$'#' ; \
		if [ -z "$${help_line/'#'#[#-]*/}" ] ; then \
			echo ; \
			echo "$${help_line}" \
				| sed 's/#\+[- ]*//' \
				| sed 's/\s*\(...\|---\)\s*$$/:/'; \
		elif [ -z "$${help_line/'#'*/}" ] ; then \
			echo "$${help_line}" \
				| sed 's/#\+[- ]*//' ; \
		else \
			help_split=($$help_line) ; \
			help_command=`echo $${help_split[0]} \
				| sed -e 's/^ *//' -e 's/ *$$//'` ; \
			help_info=`echo $${help_split[2]} \
				| sed -e 's/^ *//' -e 's/ *$$//'` ; \
			printf "   %-30s %s\n" $$help_command $$help_info ; \
		fi ; \
	done


doc/MAKE: Makefile
	# generating doc/MAKE...
	@{ \
		make help ; \
		echo ; \
		echo "---" ; \
		echo "This file was generated by: make $@" ; \
	} | egrep -v "^make\[1\]:" > $@



#**********************************************************************
### Dependency checking...

require(%):
	@printf "%-20s %s\n" \
		"$*" \
		"`which $* &> /dev/null && echo '- OK' || echo '- FAIL'`"


.PHONY: check-message
check-message:
	@echo "NOTE: simplified versions of utils like grep or sed may"
	@echo "	misbihave, if this happens please install the full"
	@echo "	version..."

.PHONY: check
check: ## Run all dependency checks
check: check-message $(foreach dep,$(DEPENDENCIES),require($(dep)))

.PHONY: check-web
check-web: ## Run web build dependency checks
check-web: check-message $(foreach dep,$(DEPENDENCIES_WEB),require($(dep)))

.PHONY: check-help
check-help: ## Run help/build (Makefile) dependency checks 
check-help: check-message $(foreach dep,$(DEPENDENCIES_HELP),require($(dep)))



#**********************************************************************
### Generic targets...

.PHONY: all
all: ## Run the full build chain
all: check doc dev dist deploy


.PHONY: doc
doc: ## Build documentation
doc: $(DOC_FILES)


.PHONY: dev
dev: ## Build the development environment
dev: $(NODE_DIR) css


.PHONY: dist
dist: ## Build distributable package
dist: electron-test-dist
#dist: electron-dist


.PHONY: test-dist
test-dist: ## Build testing distributable package
test-dist: electron-test-dist


# NOTE: with the default sort order this gets the "latest" file, not sure
# 	how portable this is...
# XXX should we build what we need to deploy???
# XXX can this be done purely in make???
.PHONY: deploy
deploy: ## Run ./scripts/deploy.sh on contents of DIST_DIR
deploy: $(wildcard $(DIST_DIR)/$(APP_NAME)-*.zip) $(wildcard scripts/deploy.sh)
	@[ -e ./scripts/deploy.sh ] \
		&& for f in $(DIST_DIR)/$(APP_NAME)-*.zip ; do \
			[ -e "$${f}" ] \
				&& bash ./scripts/deploy.sh "$${f}" \
				|| echo "Nothing to deploy." ; \
		done \
		|| echo Deploy script not found: ./scripts/deploy.sh


.PHONY: run
run: ## Run app in-place
run: electron-run 



### Cleanup...

.PHONY: clean
clean: ## Clean the BUILD_DIR directory
	$(RM) $(BUILD_DIR)


.PHONY: clean-dist
clean-dist: ## Clean DIST_DIR directory
	$(RM) $(DIST_DIR)


.PHONY: clean-all
clean-all: ## Clean all
clean-all: clean clean-dist
	$(RM) $(TARGET_DIR) $(NODE_DIR)



##---------------------------------------------- Generic components ---

.PHONY: css
css: ## Build CSS
css: $(CSS_FILES)

# NOTE: do not use these phony targets as dependencies...
# NOTE: these intersect, so one should remove the previos before making 
# 	a new app dir...
.PHONY: app-dir-full app-dir-minimal
app-dir-full: ## Build full app directory
app-dir-full: $(PACK_FULL)

app-dir-minimal: ## Build minimal app directory
app-dir-minimal: $(PACK_MINIMAL)



##----------------------------------------------------- Web/Browser ---

.PHONY: web
web: ## Build a browser-runnable package
web: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-web.zip


##-------------------------------------------------------- Electron ---

# XXX this can potentially do a build for an existing/matching *.zip in
# 	the $(DIST_DIR)...
.PHONY: electron-dist
electron-dist: ## Make electron distributable
electron-dist: VERSION := $(VERSION)-el
electron-dist: DIST := $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).zip
electron-dist: $$(DIST)


# add a time stamp to version...
.PHONY: electron-test-dist
electron-test-dist: ## Make electron test distributable
electron-test-dist: VERSION := $(VERSION)-$(DATE)-el
electron-test-dist: DIST := $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).zip
electron-test-dist: $$(DIST)
#electron-test-dist: $(DIST_DIR)/$(APP_NAME)-$$(VERSION)-$(TARGET_OS)-$(ARCH).zip


# NOTE: the "/" at the end here is significant...
.PHONY: electron-unpacked
electron-unpacked: ## Make unpacked electron app
electron-unpacked: VERSION := $(VERSION)-el
electron-unpacked: $(BUILD_DIR)/$(APP_NAME)-$$(VERSION)-$(TARGET_OS)-$(ARCH)/


#.PHONY: electron-inst
#electron-inst: $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).msi


# XXX should we have an unpacked run (-clean-run)???
.PHONY: electron-run
electron-run: ## Run app in electron
electron-run: dev
	$(ELECTRON) e.js



##-------------------------------------------------------------- NW ---

# XXX do we actually need this???
# XXX this clashes with the electron build as the recepies do not take the
# 	host framework into account...
#.PHONY: nw-dist
#nw-dist: VERSION := $(VERSION)-nw
#nw-dist: DIST := $(DIST_DIR)/$(APP_NAME)-$(VERSION)-$(TARGET_OS)-$(ARCH).zip
#nw-dist: $$(DIST)


# XXX


# XXX needs a different package.json or a way to share it with electron...
.PHONY: nw-run
nw-run: ## Run app in nw (outdated)
nw-run: dev
	nw .



##----------------------------------------------- Windows installer ---

# XXX



##----------------------------------------------------- Deb package ---

# XXX



##----------------------------------------------------- CLI package ---

# XXX



#**********************************************************************
# helpers...

up = $(subst $(eval) ,/,$(foreach x,$(subst /, ,$1),..))
zipFrom = cd $1 ; \
	  zip -r "$(call up,$1)/$2" $3
zipDelFrom = cd $1 ; \
	     zip -d "$(call up,$1)/$2" $3



#**********************************************************************
# build rules...

includeNodeModules = $(foreach m,$1,$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/$(m))
PACK_MINIMAL = $(BUILD_DIR)/$(APP_NAME)/ $(call includeNodeModules,$(INCLUDE_NODE_MODULES))
PACK_FULL = $(BUILD_DIR)/$(APP_NAME)/ $(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)


# build date...
# NOTE: this depends on lots of stuff so as to be updated in case any of
# 	the dependencies are touched...
# XXX add nw version option...
$(BUILD_INFO): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES)
	$(MD) "$(@D)"
	@echo "Build info:"
	@echo "$(APP_NAME)" | tee $(BUILD_INFO)
	@echo "version: $(VERSION)" | tee -a $(BUILD_INFO)
	@echo "date: $(DATE)" | tee -a $(BUILD_INFO)
	@echo "commit: $(COMMIT)" | tee -a $(BUILD_INFO)
	@echo "electron: $(ELECTRON_VERSION)" | tee -a $(BUILD_INFO)


%.css: %.less
	$(LESSC) $< > $@


# XXX might be a good idea to install directly to $(BUILD_DIR) so as not 
# 	to messup the current dir...
# XXX need to make this arch/os specific for cross compiling...
# XXX requirejs breaks here for some reason, breaking npm install and 
# 	the build...
#%/$(NODE_DIR): package.json
#	$(MD) "$@"
#	cp package*.json "$(@D)"
#	cd "$*" ; \
#		npm install ; \
#		electron-rebuild
#	@touch "$@"


$(NODE_DIR): package.json
	npm install
	# NOTE: this may break on some systems due to a dependency issue...
#	$(ELECTRON_REBUILD)
	@touch "$@"


# build app dir...
$(BUILD_DIR)/$(APP_NAME)/: $(PROJECT_FILES) \
		$(JS_FILES) $(CSS_FILES) $(HTML_FILES) \
		$(BUILD_INFO) \
		$(LICENSE)
	$(MD) "$@"
	cp -r $(PROJECT_FILES) $(ROOT_JS_FILES) $(HTML_FILES) \
		$(CFG_DIR) $(LIB_DIR) $(EXT_LIB_DIR) $(FEATURES_DIR) \
		$(DOMAIN_DIR) $(WORKERS_DIR) $(CSS_DIR) $(IMAGES_DIR) \
		$(ASSET_DIR) \
		$(BUILD_INFO) \
		$(LICENSE) \
		"$(BUILD_DIR)/$(APP_NAME)"
	cp $(LICENSE) "$(BUILD_DIR)/"
	# cleanup vim swap files...
	# NOTE: we need to do this as we copy whole directories...
	cd "$@" ; \
		find . -name *.sw[po] -delete
	@touch "$@"


# add $(NODE_DIR) to app dir...
# NOTE: making $(NODE_DIR) a link/junction would be quite a bit faster 
# 	but it will also choke asar...
# XXX %/$(NODE_DIR): $(NODE_DIR) ???
$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR): $(NODE_DIR)
	$(MD) "$@"
	cp -r "$(NODE_DIR)" "$(@D)"
	@touch "$@"


# add ig-* $(NODE_DIR) modules...
$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/%: $(NODE_DIR)
	$(MD) "$(@D)"
	cp -r "$(NODE_DIR)/$*" "$(@D)"
	@touch "$@"


#----------------------------------------------------------------------
# Web...

$(DIST_DIR)/$(APP_NAME)-$(VERSION)-web.zip: $(PACK_MINIMAL)
	$(MD) "$(@D)"
	$(call zipFrom,$<,$@,*)



#----------------------------------------------------------------------
# Electron desktop build...

# get the electron binary (keep this cached)...
.PHONY: electron-target
electron-target: $(TARGET_DIR)/$(ELECTRON_DIST)

.PRECIOUS: $(TARGET_DIR)/$(ELECTRON_DIST)
$(TARGET_DIR)/$(ELECTRON_DIST):
	$(MD) "$(@D)"
	wget \
		-nc "$(ELECTRON_DOWNOAD_URL)/$(@F)" \
		-O "$@"


# pack app.asar...
# XXX should this update package.json -> set "main" to "e.js"...
.PRECIOUS: $(BUILD_DIR)/app.asar
# XXX do we need to track changes to pack-full or to build it only if 
# 	app.asar is deleted?
# 	...should we bakup the original package.json???
#$(BUILD_DIR)/app.asar:
#	make check $(PACK_FULL)
$(BUILD_DIR)/app.asar: $(PACK_FULL)
	# update package.json to start electron...
	cd "$(BUILD_DIR)/$(APP_NAME)/" ; \
		sed -i 's/"index.html"/"e.js"/g' package.json
	# remove electron from the dist...
	rm -rf "$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/electron"
	cd "$(BUILD_DIR)" ; \
		$(ASAR) p "$(APP_NAME)" app.asar \
			--exclude-hidden \
			--unpack-dir node_modules/sharp


# build the app dir...
# NOTE: the "/" here is significant -- it prevents conflicts with other 
# 	rules...
# XXX need to take nw/el version part into account...
# XXX need to setup app icons...
.PRECIOUS: $(BUILD_DIR)/$(APP_NAME)-%/
$(BUILD_DIR)/$(APP_NAME)-%/: $(TARGET_DIR)/$(ELECTRON_DIST) \
		$(BUILD_DIR)/app.asar $(BUILD_INFO) $(LICENSE)
	unzip -u "$<" -d "$@" 
	cp -r $(BUILD_DIR)/app.asar* "$@/$(ASAR_PATH)/"
	cp -f "$(BUILD_INFO)" "$(LICENSE)" "$@/"
	# remove default_app.asar...
	$(RM) "$@/$(ASAR_PATH)/default_app.asar"
#	# setup app icon...
#	# XXX
	# rename app dir in zip...
	mv "$@/$(ELECTRON_BIN)$(EXT)" "$@/$(APP_BIN)$(EXT)"
	# fix permissions...
	chmod +x "$@/$(APP_BIN)$(EXT)" $(DLLs)
	@touch "$@"


# modify the archive in place...
# XXX need to take nw version part into account...
# XXX update macos package settings...
# 	there are two ways to go with this:
# 		- manually update and maintain bot Info.plist files
# 		- update the existing ones programmatically
# XXX need to setup app icons...
# XXX either keep in sync with the repack version or abstract the actions...
$(BUILD_DIR)/$(APP_NAME)-%.in-place.zip: $(TARGET_DIR)/$(ELECTRON_DIST) \
		$(BUILD_DIR)/app.asar $(BUILD_INFO)
	cp "$<" "$@.tmp"
#	# setup macos Info.plist config files...
#	# XXX
#	# setup app icon...
#	# XXX
	# remove default_app.asar and misc stuff...
	$(call zipDelFrom,"$(BUILD_DIR)",$@.tmp,"$(ASAR_PATH)/default_app.asar")
	$(call zipDelFrom,"$(BUILD_DIR)",$@.tmp,"version")
	# rename electron stuff...
#	# XXX rename "Electron Helper" on mac builds -- this needs Info.plist changes...
#		| sed 's/\(^@ \(.*\)Electron Helper\(.*\)\)$$/\1\n@=\2$(APP_NAME) Helper\3/' 
	zipnote "$@.tmp" \
		| sed 's/\(^@ LICENSE\)$$/\1\n@=LICENSE.electron/' \
		| zipnote -w "$@.tmp"
	# add app.asar and friends...
	$(MD) "$(BUILD_DIR)/$(ASAR_PATH)"
	cp -r $(BUILD_DIR)/app.asar* "$(BUILD_DIR)/$(ASAR_PATH)/"
	$(call zipFrom,"$(BUILD_DIR)",$@.tmp,"$(ASAR_PATH)" "$(notdir $(BUILD_INFO))" "$(LICENSE)")
	# rename app...
#	# XXX also rename MacOS/Electron -> $(APP_NAME) -- this needs Info.plist changes...
	zipnote "$@.tmp" \
		| sed 's/\(^@ $(ELECTRON_BIN)$(EXT)\)\(.*$$\)/\1\2\n@=$(APP_BIN)$(EXT)\2/' \
		| zipnote -w "$@.tmp"
	# cleanup...
	$(RM) $(BUILD_DIR)/$(firstword $(subst /, ,$(ASAR_PATH)))
	mv "$@.tmp" "$@"


# package the app dir (unpack - update - repack)...
# XXX need to take nw/el version part into account (???)
# XXX either keep in sync with the in-place version or abstract the actions...
$(BUILD_DIR)/$(APP_NAME)-%.repack.zip: $(BUILD_DIR)/$(APP_NAME)-%/
	$(MD) "$(@D)"
	$(call zipFrom,$<,$@,*)


# collect the built package to $(DIST_DIR)
# XXX need to take nw/el version part into account (???)
$(DIST_DIR)/$(APP_NAME)-%.zip: $(BUILD_DIR)/$(APP_NAME)-%.$(BUILD_MODE).zip
	$(MD) "$(@D)"
	cp "$<" "$@"



#----------------------------------------------------------------------
# NW.js... 

.PHONY: nw-target
nw-target: $(TARGET_DIR)/$(NW_DIST)

.PRECIOUS: $(TARGET_DIR)/$(NW_DIST)
$(TARGET_DIR)/$(NW_DIST):
	$(MD) "$(@D)"
	wget \
		-nc "$(NW_DOWNOAD_URL)/$(@F)" \
		-O "$@"


# NOTE: this needs a clean app dir...
# XXX BUG: can't find modules in unpacked node_modules...
.PRECIOUS: $(BUILD_DIR)/package.nw
$(BUILD_DIR)/package.nw: INCLUDE_NODE_MODULES += $(INCLUDE_NW_NODE_MODULES)
$(BUILD_DIR)/package.nw: PACK_MINIMAL = $(BUILD_DIR)/$(APP_NAME)/ \
		$(call includeNodeModules,$(INCLUDE_NODE_MODULES))
$(BUILD_DIR)/package.nw: $$(PACK_MINIMAL)
	# update package.json to start nw...
	cd "$<" ; \
		sed -i 's/"e.js"/"index.html"/g' package.json
	$(call zipFrom,$<,$@,*)


# XXX how do we resolve name collisions between this and electron builds???
# 	a) naming convention: specific build directory suffixes...
# 	b) generic components mixed and matched (node_modules, ImageGrid.Viewer, ...)
# 		Q: will this actually save us any time/space, considering
# 		   we'll need to copy the files anyway???
# 		   	- it would be nice to have reusable components that
# 		   	  would be used as-is to build different builds
# 		   	- this will lead to added complexity for instance 
# 		   	  in zipping...
# 	c) both...
# XXX things to do next:
# 	- copy rest of node_modules... (???)
# 	- pack...



#----------------------------------------------------------------------
# cli... 
# XXX



#----------------------------------------------------------------------
# Desktop installer...
# XXX



#----------------------------------------------------------------------
# deb/rpm package...
# XXX



#----------------------------------------------------------------------
# Mobile (cordova/PhoneGap)... 
# XXX




#**********************************************************************
#						       vim:set nowrap :
