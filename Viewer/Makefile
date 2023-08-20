#**********************************************************************
##
## ImageGrid.Viewer Makefile
##
##
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
#		- basic gcc toolchain (g++ for sharp)
#	- macOS
#		???
#	- iOS
# 	- Android
# 	- web
#
#
## To check for buld/development dependencies that make can't install itself:
##	$$ make check
##
## To setup the development environment:
##	$$ make dev
##
## To do a default build use:
##	$$ make dist
##
## In some cases making things directly starting from a clean directory
## may either fail or use global version of a utility instead of the 
## version specified for the app, if this happens first build the 
## environment and then try again:
##	$$ make dev
##	...
##	$$ make dist
##
## To print full list of user make targets use:
## 	$$ make help
##
##
## Variables to control the build:
## 	APP_NAME	- Application name
## 	APP_BIN		- App binary name (ignored for MacOS)
##
## 	TARGET_OS	- target OS (win32, linux, darwin)
## 	ARCH		- target achitecture (ia32, x86, x64, ...)
##
## 	ELECTRON_DOWNOAD_URL
## 			- URL to download electron binary
## 	ELECTRON_DIST	- electron distribution file name pattern
## 	BUILD_MODE	- can be "repack" or "in-place" (default)
##
##
## Variables to help with troubleshooting:
##	IMAGEGRID_DEBUG - force show devtools on startup
##			  NOTE: devtools will should start automaticalky
##				if loading takes too long or if it was 
##				started on last run,
##	IMAGEGRID_FORCE_SHOW
##			- force show viewer GUI on startup
##
##
## NOTE: when setting variables avoid using spaces and other characters 
## 	make can get fussy about...
 # NOTE: in most cases we do not add a "/" to target dirs to destinguish 
 # 	them from target files except for one case:
 #		$(BUILD_DIR)/$(APP_NAME)-%/
 #	this will help make destinguish it from things like:
 #		$(DIST_DIR)/$(APP_NAME)-%.zip
## NOTE: cross compilation is at this time not supported, if you try it 
## 	and it works then 1) you got very lucky and 2) tell me about it =)
## 	...at least the node native packages (sharp) will likely either 
## 	fail or	will get compiled to the wrong arch and not be used, and 
##	some non-native packages may misbehave (though I'm not aware of 
##	any at this point, so report them if you encounter one).
##	This is complicated by the fact that most of ImageGrid.Viewer is
##	platform-agnostic and will run on almost anything and will simply 
##	try to ignore broken packages and features depending on them, so
##	check the console log for any odd load reports...
##	...but note that cross-building and packaging is only possible 
##	either without the native modules or with them pre-built for the 
##	target platform, at this point.
##
##
## Examples:
##	# check if all dependencies are available...
##	$$ make check
##
##	# make development environment...
##	$$ make dev
##
## 	# full build...
## 	$$ make clean dist
##
##	# build in repack mode...
##	$$ BUILD_MODE=repack make dist
##
## 	# build for darwin/macOS... (EXPERIMENTAL)
## 	$$ TARGET_OS=darwin make clean dist
##
## 	# run with Devtools started... 
## 	$$ IMAGEGRID_DEBUG=1 make run 
##
## 	# force show the main window... 
## 	$$ IMAGEGRID_FORCE_SHOW=1 make run 
##
#
#
#----------------------------------------------------------------------
#
# ToDo:
# 	- sync version numbers between with git tags (when used)
# 	- app icons...
# 	- add a cli-only build target...
# 	- installers:
# 		- make install (user, windows / OpenDesktop)
# 			ImageGrid.desktop
# 			...
# 		- flatpak -- (still need an icon)
# 		- appimage/snap/...
# 		- deb/rpm
# 		- msi (wix)
# 		- ...
# 	- cross-compiling support (???)
# 	- cross-package with pre-built libs...
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

#.EXPORT_ALL_VARIABLES:

SHELL := bash


# variables...

APP_NAME ?= ImageGrid.Viewer

COMMENT ?= Image sorting and editing
CATEGORIES ?= Photography;Graphics;Database;Viewer;

DEVEL_PATH  := $(shell pwd)

# install mode...
# XXX revise...
INSTALL_PATH ?=
INSTALL ?= dev
ifeq ($(INSTALL_PATH),)
	# in-place...
	ifeq ($(INSTALL),dev)
		INSTALL_PATH := $(DEVEL_PATH)
		DESKTOP_PATH ?= $(HOME)/.local/share/applications/
	endif
	# local to user...
	ifeq ($(INSTALL),user)
		# XXX
		INSTALL_PATH :=
		DESKTOP_PATH ?= $(HOME)/.local/share/applications/
	endif
	# system-wide...
	ifeq ($(INSTALL),system)
		# XXX
		INSTALL_PATH :=
		DESKTOP_PATH ?= /usr/local/share/applications/
	endif
endif


APP_PATH ?= ig
ICON_PATH ?=

APP_LAUNCHER := ig.js gui

VERSION_FALLBACK ?= 4.0.0a
# NOTE: we are not using './ig --version 2> /dev/null' because it will 
# 	not work before we do 'npm install'...
APP_VERSION := $(strip $(shell \
	echo 'console.log(require("./package.json").version)' | node - \
		|| echo $(VERSION_FALLBACK)))
VERSION := $(APP_VERSION)
DATE := $(strip $(shell date "+%Y%m%d%H%M"))
COMMIT := $(strip $(shell git rev-parse HEAD))

# if node_modules does not exist, set FIRST_RUN to 1...
FIRST_RUN := $(if $(filter node_modules,$(wildcard *)),,1)



# NOTE: running things via npx can slow things down when running make on a 
# 	clean repo...
NPX := npx --yes


# Warn user...
_ := $(if $(FIRST_RUN), $(warning \
	Missing ./node_modules/: Running make on a clean repository may take \
	some time... ))


# less...
#
LESSC := $(NPX) lessc


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
ELECTRON := $(NPX) electron
ELECTRON_REBUILD := $(NPX) electron-rebuild
ASAR := $(NPX) asar
ELECTRON_VERSION := $(strip $(shell $(ELECTRON) -v 2> /dev/null))
ELECTRON_DOWNOAD_URL ?= \
	https://github.com/electron/electron/releases/download/$(ELECTRON_VERSION)
ELECTRON_DIST ?= electron-$(ELECTRON_VERSION)-$(TARGET_OS)-$(ARCH).zip


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
IMAGES_DIR = images
ASSET_DIR := data

BACKUP_EXT := .ig-backup

LICENSE = LICENSE
BUILD_INFO = $(BUILD_DIR)/INFO
PROJECT_FILES = package.json
HTML_FILES := $(wildcard *.html)

# XXX should this be a wildcard???
GENERATED_JS_FILES := \
	version.js
GENERATED_FILES := \
	$(GENERATED_JS_FILES) \
	$(APP_NAME).desktop

CSS_FILES := \
	$(wildcard css/*.css)
ROOT_JS_FILES := \
	$(wildcard *.js) \
	version.js
# NOTE: this is only used for make change/dependency tracking checking...
JS_FILES := $(ROOT_JS_FILES) \
	$(GENERATED_JS_FILES) \
	$(wildcard $(DOMAIN_DIR)/*.js) \
	$(wildcard $(FEATURES_DIR)/*.js) \
	$(wildcard $(LIB_DIR)/*.js) \
	$(wildcard $(LIB_DIR)/*/*.js) \
	$(wildcard $(EXT_LIB_DIR)/*.js)
DOC_FILES := doc/MAKE

REQUREJS := $(NODE_DIR)/requirejs/bin/r.js


INCLUDE_NODE_MODULES = \
	ig-object ig-actions ig-features ig-types ig-argv object-run \
	requirejs requirejs-plugins

INCLUDE_NW_NODE_MODULES = app-module-path

PATCHES := $(REQUREJS)



#**********************************************************************
# dependencies to check...
#
DEPENDENCIES_HELP = sed grep printf 
DEPENDENCIES_WEB = node npm npx

DEPENDENCIES = $(DEPENDENCIES_WEB) \
	$(DEPENDENCIES_HELP) \
	wget zip unzip zipnote git



#**********************************************************************
### Help and info...

# help generator...
#
# Help syntax:
# 	"## Normal help text..."
#
# 	"### Section title..."
# 	"##----- Section title ---"
#
.PHONY: help
help: ## Print make target help and exit
help:
	@IFS=$$'\n' ; \
	help_lines=(`grep -Fh "##" $(MAKEFILE_LIST) \
		| grep -Fv grep \
		| grep -Fv '"##' \
		| sed -e 's/\\$$//'`); \
	for help_line in $${help_lines[@]}; do \
		IFS=$$'#' ; \
		if [ -z "$${help_line/'#'#[#-]*/}" ] ; then \
			echo ; \
			echo "$${help_line}" \
				| sed -e 's/#\+[- ]*//' \
					-e 's/\s*\(...\|---\)\s*$$/:/'; \
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
	} | grep -Ev "^make\[1\]:" > $@


.PHONY: version
version: ## Print version and exit
version:
	@echo $(APP_VERSION)



# XXX might be a good idea to print the generated env...
#env:



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
dev: $(JS_FILES) $(NODE_DIR) $(PATCHES)

.PHONY: dev-npm
dev-npm: ## Install the npm global dev package (might need sudo)
dev-npm: $(JS_FILES) $(PATCHES)
	npm install -g .

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


# XXX INSTALL
.PHONY: install
install: dev


### Cleanup...

.PHONY: clean
clean: ## Cleanup
clean: clean-generated
	$(RM) $(BUILD_DIR) 


.PHONY: clean-generated
clean-generated: ## Clean generated files
	$(RM) $(GENERATED_FILES)


.PHONY: clean-dist
clean-dist: ## Clean DIST_DIR directory
	$(RM) $(DIST_DIR)


.PHONY: clean-all
clean-all: ## Clean all
clean-all: clean clean-dist
	$(RM) $(TARGET_DIR) $(NODE_DIR)



##---------------------------------------------- Generic components ---

.PHONY: js
js: ## Build JS modules
js: $(GENERATED_JS_FILES)


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



#------------------------------------------------ Windows installer ---

# XXX



#------------------------------------------------------ CLI package ---

# XXX



##---------------------------------------------------- Open Desktop ---

.PHONY: desktop-file
desktop-file: $(APP_NAME).desktop

.PHONY: desktop
desktop: dev desktop-file
	desktop-file-install --dir="$(DESKTOP_PATH)" $(APP_NAME).desktop
	update-desktop-database "$(DESKTOP_PATH)"

.PHONY: desktop-remove
desktop-remove:
	rm -f $(DESKTOP_PATH)/$(APP_NAME).desktop



#**********************************************************************
# helpers...

up = $(subst $(eval) ,/,$(foreach x,$(subst /, ,$1),..))
zipFrom = cd $1 ; \
	  zip -r "$(call up,$1)/$2" $3
zipDelFrom = cd $1 ; \
	     zip -d "$(call up,$1)/$2" $3



#**********************************************************************
# build rules...

includeNodeModules = \
	$(foreach m,$1,$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/$(m))
PACK_MINIMAL = \
	$(BUILD_DIR)/$(APP_NAME)/ \
	$(call includeNodeModules,$(INCLUDE_NODE_MODULES))
PACK_FULL = \
	$(BUILD_DIR)/$(APP_NAME)/ \
	$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)


# build data...
# NOTE: this depends on lots of stuff so as to be updated in case any of
# 	the dependencies are touched...
$(BUILD_INFO): $(CSS_FILES) $(NODE_DIR) $(PROJECT_FILES) \
		$(JS_FILES) $(HTML_FILES)
	$(MD) "$(@D)"
	@echo "Build info:"
	@echo "$(APP_NAME)" | tee "$@"
	@echo "version: $(VERSION)" | tee -a "$@"
	@echo "date: $(DATE)" | tee -a "$@"
	@echo "commit: $(COMMIT)" | tee -a "$@"
	@echo "electron: $(ELECTRON_VERSION)" | tee -a "$@"


# basic templates...
# XXX revise $LAUNCHER -- should it be absolute or relative and when???
%: %.tpl package.json
	cat $< \
		| sed -e 's/\$$APP_NAME/$(APP_NAME)/' \
			-e 's/\$$COMMENT/$(subst \/,\/,$(COMMENT))/' \
			-e 's/\$$CATEGORIES/$(subst \/,\/,$(CATEGORIES))/' \
			-e 's/\$$VERSION/$(APP_VERSION)/' \
			-e 's/\$$BUILD/$(DATE)/' \
			-e 's/\$$COMMIT/$(COMMIT)/' \
			-e 's#\$$APP_PATH#$(APP_PATH)#' \
			-e 's#\$$ICON_PATH#$(ICON_PATH)#' \
			-e 's#\$$LAUNCHER#$(INSTALL_PATH)/$(APP_LAUNCHER)#' \
		> $@


$(APP_NAME).desktop: App.desktop
	mv $< $@


# XXX might be a good idea to install directly to $(BUILD_DIR) so as not 
# 	to mess up the current dir...
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
	npm install \
		--platform=$(TARGET_OS) \
		--arch=$(ARCH)
#	npm install
#	# patch requirejs (see: NOTES)
#	make patched-requirejs
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
		$(DOMAIN_DIR) $(CSS_DIR) $(IMAGES_DIR) \
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
$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR): $(NODE_DIR) $(PATCHES)
	$(MD) "$@"
	cp -r "$(NODE_DIR)" "$(@D)"
	@touch "$@"


# add ig-* $(NODE_DIR) modules...
$(BUILD_DIR)/$(APP_NAME)/$(NODE_DIR)/%: $(NODE_DIR)
	$(MD) "$(@D)"
	cp -r "$(NODE_DIR)/$*" "$(@D)"
	@touch "$@"



##--------------------------------------------------------- Patches ---

# patch/unpatch requirejs (see: NOTES)
# XXX need to find a better way around this...
$(REQUREJS): $(NODE_DIR) $(REQUREJS)$(BACKUP_EXT)

$(REQUREJS)$(BACKUP_EXT): $(NODE_DIR)
	# HACK: for some reason requirejs breaks if we do not do this (see: NOTES)
	cp -f $(REQUREJS){,$(BACKUP_EXT)}
	cat $(REQUREJS)$(BACKUP_EXT) \
		| sed 's/^\(#!\/\)/\/\/\1/' \
		> $(REQUREJS)

.PHONY: patched-requirejs
patched-requirejs: ## Patch requirejs (see: NOTES)
patched-requirejs: $(REQUREJS)

.PHONY: unpatched-requirejs
unpatched-requirejs: ## Unpatch requirejs
unpatched-requirejs: 
	[ -e $(REQUREJS)$(BACKUP_EXT) ] \
		&& mv -f $(REQUREJS){$(BACKUP_EXT),}



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



##------------------------------------------------------------- CLI ---

.PHONY: devel-cli
devel-cli: ## Install CLI interface as a link to this tree.
devel-cli: dev 
	npm link

.PHONY: cli
cli: ## install CLI interface as independent package.
cli: dev 
	npm install -g .



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
