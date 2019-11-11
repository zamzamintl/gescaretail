from odoo import models, fields


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    module_account_models = fields.Boolean(
        string="Use Odoo4Fashion in Accounting"
    )
    module_sale_models = fields.Boolean(
        string="Use Odoo4Fashion in Sale"
    )
    module_purchase_models = fields.Boolean(
        string="Use Odoo4Fashion in Purchase"
    )
    module_stock_models = fields.Boolean(
        string="Use Odoo4Fashion in Stock"
    )
    module_product_composition = fields.Boolean(
        string="Product Compositions"
    )
    module_product_tags = fields.Boolean(
        string="Product Tags"
    )

    module_purchase_sale_preorders = fields.Boolean(
        string="Pre orders"
    )
    module_client_sale_history = fields.Boolean(
        string="Client Sale History"
    )
    module_o4f_product_labels = fields.Boolean(
        string="Product Labels"
    )
    module_product_models_pricelist = fields.Boolean(
        string="Pricelist reports"
    )
    module_product_barcode_generator = fields.Boolean(
        string="Barcode Generator"
    )
    module_product_stock_grid = fields.Boolean(
        string="Grid view for stock"
    )
    module_product_variant_prices = fields.Boolean(
        string="Manage Prices Odoo4Fashion"
    )
