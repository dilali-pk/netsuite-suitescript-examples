/**
 * Name:        DA Minimum Order (SuiteCommerce extension entry point)
 * Purpose:     Adds a live minimum order notice to the cart summary.
 * API:         Extensibility API only (Cart and Environment components), so
 *              the extension survives SuiteCommerce upgrades untouched.
 * @author      Dilshad Ali
 */
define('DA.MinimumOrder', ['DA.MinimumOrder.View'], function (MinimumOrderView) {
    'use strict';

    return {
        mountToApp: function (container) {
            var cart = container.getComponent('Cart');
            var environment = container.getComponent('Environment');
            var minimum = Number(environment.getConfig('daMinimumOrder.amount')) || 0;

            if (!cart || minimum <= 0) {
                return;
            }

            cart.addChildView('Cart.Summary', function () {
                return new MinimumOrderView({ cart: cart, minimum: minimum });
            });
        }
    };
});
