/**
 * Name:        DA Minimum Order View
 * Purpose:     Renders the progress toward the minimum order amount and
 *              re-renders whenever a cart line is added, changed or removed.
 * @author      Dilshad Ali
 */
define('DA.MinimumOrder.View', ['SCView', 'da_minimum_order.tpl'], function (SCViewModule, template) {
    'use strict';

    var SCView = SCViewModule.SCView;
    var CART_EVENTS = ['afterAddLine', 'afterUpdateLine', 'afterRemoveLine'];

    function MinimumOrderView(options) {
        SCView.call(this, options);

        this.template = template;
        this.cart = options.cart;
        this.minimum = options.minimum;
        this.subtotal = 0;

        var self = this;
        var refresh = function () {
            self.cart.getSummary().then(function (summary) {
                self.subtotal = Number(summary.subtotal) || 0;
                self.render();
            });
        };

        CART_EVENTS.forEach(function (eventName) {
            self.cart.on(eventName, refresh);
        });
        refresh();
    }

    MinimumOrderView.prototype = Object.create(SCView.prototype);
    MinimumOrderView.prototype.constructor = MinimumOrderView;

    MinimumOrderView.prototype.getContext = function () {
        var remaining = Math.max(this.minimum - this.subtotal, 0);
        return {
            reached: remaining === 0,
            remaining: remaining.toFixed(2),
            minimum: this.minimum.toFixed(2),
            percent: Math.min(Math.round((this.subtotal / this.minimum) * 100), 100)
        };
    };

    return MinimumOrderView;
});
