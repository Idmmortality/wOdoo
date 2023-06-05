/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { FloorScreen } from "@pos_restaurant/app/floor_screen/floor_screen";
import { TipScreen } from "@pos_restaurant/js/Screens/TipScreen";

const NON_IDLE_EVENTS = [
    "mousemove",
    "mousedown",
    "touchstart",
    "touchend",
    "touchmove",
    "click",
    "scroll",
    "keypress",
];
let IDLE_TIMER_SETTER;

patch(PosStore.prototype, "pos_restaurant.PosStore", {
    /**
     * @override
     */
    async setup() {
        await this._super(...arguments);
        if (this.globalState.config.module_pos_restaurant) {
            this.setActivityListeners();
            this.showScreen("FloorScreen", { floor: this.globalState.table?.floor || null });
        }
    },
    setActivityListeners() {
        IDLE_TIMER_SETTER = this.setIdleTimer.bind(this);
        for (const event of NON_IDLE_EVENTS) {
            window.addEventListener(event, IDLE_TIMER_SETTER);
        }
    },
    setIdleTimer() {
        clearTimeout(this.idleTimer);
        if (this.shouldResetIdleTimer()) {
            this.idleTimer = setTimeout(() => this.actionAfterIdle(), 60000);
        }
    },
    async actionAfterIdle() {
        const isPopupClosed = this.popup.closePopupsButError();
        if (isPopupClosed) {
            this.closeTempScreen();
            const { table } = this.globalState;
            const order = this.globalState.get_order();
            if (order && order.get_screen_data().name === "ReceiptScreen") {
                // When the order is finalized, we can safely remove it from the memory
                // We check that it's in ReceiptScreen because we want to keep the order if it's in a tipping state
                this.globalState.removeOrder(order);
            }
            this.showScreen("FloorScreen", { floor: table?.floor });
        }
    },
    shouldResetIdleTimer() {
        const stayPaymentScreen =
            this.mainScreen.component === PaymentScreen &&
            this.globalState.get_order().paymentlines.length > 0;
        return (
            this.globalState.config.module_pos_restaurant &&
            !stayPaymentScreen &&
            this.mainScreen.component !== FloorScreen
        );
    },
    showScreen(screenName) {
        this._super(...arguments);
        this.setIdleTimer();
    },
    closeScreen() {
        if (this.globalState.config.module_pos_restaurant && !this.globalState.get_order()) {
            return this.showScreen("FloorScreen");
        }
        return this._super(...arguments);
    },
    addOrderIfEmpty() {
        if (!this.globalState.config.module_pos_restaurant) {
            return this._super(...arguments);
        }
    },
    /**
     * @override
     * Before closing pos, we remove the event listeners set on window
     * for detecting activities outside FloorScreen.
     */
    async closePos() {
        if (IDLE_TIMER_SETTER) {
            for (const event of NON_IDLE_EVENTS) {
                window.removeEventListener(event, IDLE_TIMER_SETTER);
            }
        }
        return this._super(...arguments);
    },
    showBackButton() {
        return (
            this._super(...arguments) ||
            this.mainScreen.component === TipScreen ||
            (this.mainScreen.component === ProductScreen &&
                this.globalState.config.module_pos_restaurant)
        );
    },
});
