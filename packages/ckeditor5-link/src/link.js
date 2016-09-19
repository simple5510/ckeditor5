/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Feature from '../core/feature.js';
import ClickObserver from '../engine/view/observer/clickobserver.js';
import LinkEngine from './linkengine.js';
import LinkElement from './linkelement.js';

import Model from '../ui/model.js';

import ButtonController from '../ui/button/button.js';
import ButtonView from '../ui/button/buttonview.js';

import LinkBalloonPanel from './ui/linkballoonpanel.js';
import LinkBalloonPanelView from './ui/linkballoonpanelview.js';

/**
 * The link feature. It introduces the Link and Unlink buttons and the <kbd>Ctrl+L</kbd> keystroke.
 *
 * It uses the {@link link.LinkEngine link engine feature}.
 *
 * @memberOf link
 * @extends core.Feature
 */
export default class Link extends Feature {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ LinkEngine ];
	}

	/**
	 * @inheritDoc
	 */
	init() {
		this.editor.editing.view.addObserver( ClickObserver );

		/**
		 * Link balloon panel component.
		 *
		 * @member {link.ui.LinkBalloonPanel} link.Link#balloonPanel
		 */
		this.balloonPanel = this._createBalloonPanel();

		// Create toolbar buttons.
		this._createToolbarLinkButton();
		this._createToolbarUnlinkButton();
	}

	/**
	 * Creates a toolbar link button. Clicking this button will show
	 * {@link link.Link#balloonPanel} attached to the selection.
	 *
	 * @private
	 */
	_createToolbarLinkButton() {
		const editor = this.editor;
		const viewDocument = editor.editing.view;
		const linkCommand = editor.commands.get( 'link' );
		const t = editor.t;

		// Create button model.
		const linkButtonModel = new Model( {
			isEnabled: true,
			isOn: false,
			label: t( 'Link' ),
			icon: 'link',
			keystroke: 'CTRL+L'
		} );

		// Bind button model to the command.
		linkButtonModel.bind( 'isEnabled' ).to( linkCommand, 'isEnabled' );

		// Show the panel on button click only when editor is focused.
		this.listenTo( linkButtonModel, 'execute', () => {
			if ( !viewDocument.isFocused ) {
				return;
			}

			this._attachPanelToElement();
			this.balloonPanel.urlInput.view.select();
		} );

		// Add link button to feature components.
		editor.ui.featureComponents.add( 'link', ButtonController, ButtonView, linkButtonModel );
	}

	/**
	 * Create a toolbar unlink button. Clicking this button will unlink
	 * the selected link.
	 *
	 * @private
	 */
	_createToolbarUnlinkButton() {
		const editor = this.editor;
		const t = editor.t;
		const unlinkCommand = editor.commands.get( 'unlink' );

		// Create the button model.
		const unlinkButtonModel = new Model( {
			isEnabled: false,
			isOn: false,
			label: t( 'Unlink' ),
			icon: 'unlink'
		} );

		// Bind button model to the command.
		unlinkButtonModel.bind( 'isEnabled' ).to( unlinkCommand, 'hasValue' );

		// Execute unlink command and hide panel, if open.
		this.listenTo( unlinkButtonModel, 'execute', () => {
			editor.execute( 'unlink' );
		} );

		// Add unlink button to feature components.
		editor.ui.featureComponents.add( 'unlink', ButtonController, ButtonView, unlinkButtonModel );
	}

	/**
	 * Creates the {@link link.ui.LinkBalloonPanel LinkBalloonPanel} instance
	 * and attaches link command to {@link link.LinkBalloonPanelModel#execute} event.
	 *
	 *	                       +------------------------------------+
	 *	                       | <a href="http://foo.com">[foo]</a> |
	 *	                       +------------------------------------+
	 *	                                      Document
	 *	             Value set in doc   ^                   +
	 *	             if it's correct.   |                   |
	 *	                                |                   |
	 *	                      +---------+--------+          |
	 *	Panel.urlInput#value  | Value validation |          |  User clicked "Link" in
	 *	       is validated.  +---------+--------+          |  the toolbar. Retrieving
	 *	                                |                   |  URL from Document and setting
	 *	             PanelModel fires   |                   |  PanelModel#url.
	 *	          PanelModel#execute.   +                   v
	 *
	 *	                              +-----------------------+
	 *	                              | url: 'http://foo.com' |
	 *	                              +-----------------------+
	 *	                                      PanelModel
	 *	                                ^                   +
	 *	                                |                   |  Input field is
	 *	                  User clicked  |                   |  in sync with
	 *	                       "Save".  |                   |  PanelModel#url.
	 *	                                +                   v
	 *
	 *	                            +--------------------------+
	 *	                            | +----------------------+ |
	 *	                            | |http://foo.com        | |
	 *	                            | +----------------------+ |
	 *	                            |                   +----+ |
	 *	                            |                   |Save| |
	 *	                            |                   +----+ |
	 *	                            +--------------------------+
	 * @private
	 * @returns {link.ui.LinkBalloonPanel} Link balloon panel instance.
	 */
	_createBalloonPanel() {
		const editor = this.editor;
		const viewDocument = editor.editing.view;
		const linkCommand = editor.commands.get( 'link' );

		// Create the model of the panel.
		const panelModel = new Model( {
			maxWidth: 300
		} );

		// Bind panel model to command.
		panelModel.bind( 'url' ).to( linkCommand, 'value' );

		// Create the balloon panel instance.
		const balloonPanel = new LinkBalloonPanel( panelModel, new LinkBalloonPanelView( editor.locale ) );

		// Observe `LinkBalloonPanelMode#executeLink` event from within the model of the panel,
		// which means that form has been submitted.
		this.listenTo( panelModel, 'executeLink', () => {
			editor.execute( 'link', balloonPanel.urlInput.value );
			this._hidePanel( { focusDocument: true } );
		} );

		// Observe `LinkBalloonPanelMode#executeUnlink` event from within the model of the panel,
		// which means that the `Unlink` button has been clicked.
		this.listenTo( panelModel, 'executeUnlink', () => {
			editor.execute( 'unlink' );
			this._hidePanel( { focusDocument: true } );
		} );

		// Observe `LinkBalloonPanelMode#executeCancel` event from within the model of the panel,
		// which means that the `Cancel` button has been clicked.
		this.listenTo( panelModel, 'executeCancel', () => this._hidePanel( { focusDocument: true } ) );

		// On panel show attach close by `Esc` press and click out of panel actions, on panel hide clean up listeners.
		this.listenTo( balloonPanel.view.model, 'change:isVisible', ( evt, propertyName, value ) => {
			if ( value ) {
				// Handle close by `Esc`.
				this.balloonPanel.view.listenTo( document, 'keydown', this._closePanelOnClick.bind( this ) );

				// Handle close by clicking out of the panel.
				// Note that it is not handled by a `click` event, it is because clicking on link button or directly on link element
				// was opening and closing panel at the same time.
				this.balloonPanel.view.listenTo( document, 'mouseup', ( evt, domEvt ) => {
					// Do nothing when the panel was clicked.
					if ( balloonPanel.view.element.contains( domEvt.target ) ) {
						return;
					}

					// When click was out of the panel then hide it.
					balloonPanel.view.hide();

					// When editor was clicked then restore editor focus.
					if ( editor.ui.view.element.contains( domEvt.target ) ) {
						viewDocument.focus();
					}
				} );
			} else {
				this.balloonPanel.view.stopListening( document );
				this.stopListening( viewDocument );
			}
		} );

		// Handle click on document and show panel when selection is placed inside the link element.
		// Keep panel open till selection will be inside the same link element.
		viewDocument.on( 'click', () => {
			const viewSelection = viewDocument.selection;
			const parentLink = getPositionParentLink( viewSelection.getFirstPosition() );

			if ( viewSelection.isCollapsed && parentLink ) {
				this._attachPanelToElement();

				this.listenTo( viewDocument, 'render', () => {
					const position = viewSelection.getFirstPosition();

					if ( !position ) {
						return;
					}

					if ( !viewSelection.isCollapsed || parentLink !== getPositionParentLink( position ) ) {
						this._hidePanel();
					} else {
						this._attachPanelToElement( parentLink );
					}
				} );
			}
		} );

		// Handle `Ctrl+L` keystroke and show panel.
		editor.keystrokes.set( 'CTRL+L', () => {
			this._attachPanelToElement();
			this.balloonPanel.urlInput.view.select();
		} );

		// Append panel element to body.
		editor.ui.add( 'body', balloonPanel );

		return balloonPanel;
	}

	/**
	 * Shows {@link link#balloonPanel LinkBalloonPanel} and attach to target element.
	 * If selection is collapsed and is placed inside link element, then panel will be attached
	 * to whole link element, otherwise will be attached to the selection.
	 *
	 * Input inside panel will be focused.
	 *
	 * @private
	 * @param {core.view.LinkElement} [parentLink] Target element.
	 */
	_attachPanelToElement( parentLink ) {
		const viewDocument = this.editor.editing.view;
		const domEditableElement = viewDocument.domConverter.getCorrespondingDomElement( viewDocument.selection.editableElement );
		const targetLink = parentLink || getPositionParentLink( viewDocument.selection.getFirstPosition() );

		// When selection is inside link element, then attach panel to this element.
		if ( targetLink ) {
			this.balloonPanel.view.attachTo(
				viewDocument.domConverter.getCorrespondingDomElement( targetLink ),
				domEditableElement
			);
		}
		// Otherwise attach panel to the selection.
		else {
			this.balloonPanel.view.attachTo(
				viewDocument.domConverter.viewRangeToDom( viewDocument.selection.getFirstRange() ),
				domEditableElement
			);
		}
	}

	/**
	 * Hide {@link link#balloonPanel LinkBalloonPanel}.
	 *
	 * @private
	 * @param {Object} [options={}] Additional options.
	 * @param {Boolean} [options.focusDocument=false] When `true` then editor focus will be restored after panel hide.
	 */
	_hidePanel( options = {} ) {
		this.balloonPanel.view.hide();

		if ( options.focusDocument ) {
			this.editor.editing.view.focus();
		}
	}

	/**
	 * Hide balloon panel on `ESC` key press event and restore editor focus.
	 *
	 * **Note**: this method is `@protected` for testing purposes only.
	 *
	 * @protected
	 * @param {utils.EventInfo} evt Information about the event.
	 * @param {KeyboardEvent} domEvt DOM `keydown` event.
	 */
	_closePanelOnClick( evt, domEvt ) {
		if ( domEvt.keyCode == 27 ) {
			this._hidePanel( { focusDocument: true } );
		}
	}
}

// Get position parent LinkElement.
//
// @private
// @param {engine.view.Position} position
function getPositionParentLink( position ) {
	return position.parent.getAncestors().find( ( ancestor ) => ancestor instanceof LinkElement );
}
