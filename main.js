/*
 * Copyright (c) 2013 Tomás Malbrán. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, unparam: true */
/*global define, $, window, brackets, Mustache */

define(function (require, exports, module) {
    "use strict";
	
    require("thirdparty/jquery.autogrow-textarea");
    
    var AppInit            = brackets.getModule("utils/AppInit"),
        ExtensionUtils     = brackets.getModule("utils/ExtensionUtils"),
        StringUtils        = brackets.getModule("utils/StringUtils"),
        DocumentManager    = brackets.getModule("document/DocumentManager"),
        LanguageManager    = brackets.getModule("language/LanguageManager"),
        MainViewFactory    = brackets.getModule("view/MainViewFactory"),
        ProjectManager     = brackets.getModule("project/ProjectManager"),
        FileSystem         = brackets.getModule("filesystem/FileSystem"),
        FontHolderTemplate = require("text!htmlContent/font-holder.html"),
        _                  = brackets.getModule("thirdparty/lodash"),
        
    /* List of Supported font Extensions */
        FONT_EXTENSIONS = ["ttf", "otf", "woff"],
    
    /** @type {Array.<FontView>} */
        _viewers = {};
    
    
    
    /**
     * FontView objects are constructed when an font is opened 
     * @constructor
     * @param {!File} file  The image file object to render
     * @param {!jQuery} container  The container to render the image view in
     */
    function FontView(file, $container) {
        this.file    = file;
        this.relPath = ProjectManager.makeProjectRelativeIfPossible(this.file.fullPath);
        this.$el     = $(Mustache.render(FontHolderTemplate, {
            fullPath : this.file.fullPath,
            relPath  : this.relPath,
            now      : new Date().valueOf()
        }));
        
        $container.append(this.$el);
        
        this.$fontFace    = this.$el.find(".font-face");
        this.$fontPath    = this.$el.find(".font-path");
        this.$fontData    = this.$el.find(".font-data");
        this.$fontDisplay = this.$el.find(".font-display");
        this.$fontEdit    = this.$el.find(".font-edit");
        
        // Update the file stats
        this._updateStats();
        
        // make sure we always show the right file name
        $(DocumentManager).on("fileNameChange", _.bind(this._onFilenameChange, this));
        
        var self = this;
        this.$el
            .on("click.FontView", function (e) {
                if (self.$fontEdit.is(":visible") && e.target !== self.$fontEdit.get(0)) {
                    self._updateText();
                }
            })
            .on("click.FontView", ".font-display", function (e) {
                self.$fontDisplay.hide();
                self.$fontEdit.show().autogrow().focus();
                e.stopImmediatePropagation();
            })
            .on("change.FontView", ".font-edit", function () {
                self._updateText();
            });
        
        _viewers[file.fullPath] = this;
    }
    
    /**
     * Updates the text to show icons
     */
    FontView.prototype._updateText = function () {
        var text     = this.$fontEdit.val(),
            replaced = text.replace(/\\(\w{4})/g, "&#x$1;").replace(/U\+(\w{4})/g, "&#x$1;").replace(/\n/g, "<br />");
        
        this.$fontEdit.hide();
        this.$fontDisplay.html(replaced).show();
    };
    
    /**
     * Updates the Font Stats
     */
    FontView.prototype._updateStats = function () {
        var self = this;
        this.file.stat(function (err, stat) {
            if (!err && stat._size) {
                var dataString = StringUtils.prettyPrintBytes(stat._size, 2);
                self.$fontData.text(dataString).attr("title", dataString);
            }
        });
    };
    
    /**
     * DocumentManger.fileNameChange handler - when a font is renamed, we must 
     * update the view
     * 
     * @param {jQuery.Event} e  event
     * @param {!string} oldPath  the name of the file that's changing changing 
     * @param {!string} newPath  the name of the file that's changing changing 
     * @private
     */
    FontView.prototype._onFilenameChange = function (e, oldPath, newPath) {
        // File objects are already updated when the event is triggered
        // so we just need to see if the file has the same path as our image
        if (this.file.fullPath === newPath) {
            this.relPath = ProjectManager.makeProjectRelativeIfPossible(newPath);
            this.$fontPath.text(this.relPath).attr("title", this.relPath);
        }
    };
    
    /**
     * View Interface functions
     */

    /* 
     * Retrieves the file object for this view
     * return {!File} the file object for this view
     */
    FontView.prototype.getFile = function () {
        return this.file;
    };
    
    /* 
     * Updates the layout of the view
     */
    FontView.prototype.updateLayout = function () {
        var $container = this.$el.parent(),
            pos        = $container.position(),
            iWidth     = $container.innerWidth(),
            iHeight    = $container.innerHeight(),
            oWidth     = $container.outerWidth(),
            oHeight    = $container.outerHeight();
            
        // $view is "position:absolute" so 
        //  we have to update the height, width and position
        this.$el.css({
            top    : pos.top  + ((oHeight - iHeight) / 2),
            left   : pos.left + ((oWidth  - iWidth)  / 2),
            width  : iWidth,
            height : iHeight
        });
    };
    
    /* 
     * Destroys the view
     */
    FontView.prototype.destroy = function () {
        delete _viewers[this.file.fullPath];
        $(DocumentManager).off("fileNameChange", _.bind(this._onFilenameChange, this));
        this.$el.off(".FontView").remove();
    };
    
    /* 
     * Refreshes the image preview with what's on disk
     */
    FontView.prototype.refresh = function () {
        var noCacheUrl = this.$fontFace.data("src"),
            now        = new Date().valueOf(),
            index      = noCacheUrl.indexOf("?");

        // Strip the old param off 
        if (index > 0) {
            noCacheUrl = noCacheUrl.slice(0, index);
        }
        
        // Add a new param which will force chrome to re-read the image from disk 
        noCacheUrl = noCacheUrl + "?ver=" + now;

        // Update the DOM node with the src URL 
        this.$fontFace.html("@font-face {font-family:'FontDisplay';src: url('" + noCacheUrl + "');}");
        this._updateStats();
    };
    
    
    
    /**
     * Creates an image view object and adds it to the specified pane
     * @param {!File} file - the file to create an image of
     * @param {!Pane} pane - the pane in which to host the view
     * @return {jQuery.Promise} 
     */
    function _createFontView(file, pane) {
        var view = pane.getViewForPath(file.fullPath);
        
        if (view) {
            pane.showView(view);
        } else {
            view = new FontView(file, pane.$content);
            pane.addView(view, true);
        }
        return new $.Deferred().resolve().promise();
    }
    
    /**
     * Handles file system change events so we can refresh image viewers for the files that changed on disk due to external editors
     * @param {jQuery.event} event  event object
     * @param {?File} file  file object that changed
     * @param {Array.<FileSystemEntry>=} added  If entry is a Directory, contains zero or more added children
     * @param {Array.<FileSystemEntry>=} removed  If entry is a Directory, contains zero or more removed children
     */
    function _handleFileSystemChange(event, entry, added, removed) {
        // this may have been called because files were added 
        //  or removed to the file system.  We don't care about those
        if (!entry || entry.isDirectory) {
            return;
        }
        
        // Look for a viewer for the changed file
        var viewer = _viewers[entry.fullPath];

        // viewer found, call its refresh method
        if (viewer) {
            viewer.refresh();
        }
    }
    
    
    /** Creates a new Font Language */
    var binary = LanguageManager.getLanguage("binary");
    binary.removeFileExtension(FONT_EXTENSIONS);
    
    LanguageManager.defineLanguage("font", {
        name           : "Font",
        fileExtensions : FONT_EXTENSIONS,
        isBinary       : true
    });
    
    
    /*
     * Install an event listener to receive all file system change events
     * so we can refresh the view when changes are made to the image in an external editor
     */
    FileSystem.on("change", _handleFileSystemChange);
    
    /* 
     * Initialization, register our view factory
     */
    MainViewFactory.registerViewFactory({
        canOpenFile: function (fullPath) {
            var lang = LanguageManager.getLanguageForPath(fullPath);
            return (lang.getId() === "font");
        },
        openFile: function (file, pane) {
            return _createFontView(file, pane);
        }
    });
    
    AppInit.appReady(function () {
        ExtensionUtils.loadStyleSheet(module, "styles/main.css");
    });
});