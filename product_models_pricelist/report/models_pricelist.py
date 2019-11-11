# -*- coding: utf-8 -*-

from odoo import models, api
from base64 import b64decode
from io import BytesIO
import re


class ReportProductModelsPricelist(models.AbstractModel):
    _name = 'report.product_models_pricelist.models_pricelist'

    @api.model
    def _get_report_values(self, docids, data=None):
        measurebars = self.env['product.template.model.pricelist'].browse(
            [data.get('record_id')]
        )._get_measurebars(data.get('ids'))
        report = self.env['ir.actions.report']._get_report_from_name(
            'product_models_pricelist.models_pricelist'
        )

        return {
            'doc_ids': self.ids,
            'doc_model': report.model,
            'docs': measurebars
        }


class ReportProductModelsPricelistXlsx(models.AbstractModel):
    _name = 'report.product_models_pricelist.product_pricelist_xlsx'
    _inherit = 'report.report_xlsx.abstract'

    def generate_xlsx_report(self, workbook, data, records):
        sheet = workbook.add_worksheet('Product Prices')
        row = 0
        column_headers = ['', 'Product', '']
        column_headers.append('Model')
        sheet.write_row(row, 0, column_headers)
        bold = workbook.add_format({'bold': True})
        bold_border = workbook.add_format({'bold': True, 'border': 2})
        border = workbook.add_format({'border': 1})
        row = 1
        if data.get('show_image'):
            column = 3
        else:
            column = 2
        measurebars = self.env['product.template.model.pricelist'].browse(
            [data.get('record_id')])._get_measurebars(data.get('ids'))
        for bar in measurebars:
            measurebar = bar.get('measurebar')
            if data.get('show_image'):
                image_string = measurebar.get('image')
                if image_string:
                    image = BytesIO(
                        b64decode(
                            re.sub("data:image/jpeg;base64", '',
                                   image_string)
                        ))
                    sheet.insert_image(row, 0, measurebar.get('name'),
                                       {'image_data': image})
            if len(measurebar.get('products')) > 0:
                sheet.write_rich_string(row, 1, measurebar.get('name'), bold)
                column += 1
                for index, attr in enumerate(measurebar.get('attributes')[0]):
                    sheet.write_rich_string(row, column, attr.get('name'),
                                            bold_border)
                    sheet.write_rich_string(row + 1, column,
                                            measurebar.get('products')[0][
                                                index].get(
                                                'price'), border)
                    column += 1
                column = 2
                row += 1
                for index, attr in enumerate(measurebar.get('attributes')[1]):
                    if attr == 0:
                        sheet.write(row, column, '')
                    else:
                        sheet.write_rich_string(row, column, attr.get('name'),
                                                bold_border)
                        for index2, attr1 in enumerate(
                                measurebar.get('attributes')[0]):
                            sheet.write_rich_string(row, 3 + index2,
                                                    measurebar.get('products')[
                                                        index][
                                                        index2].get(
                                                        'price'), border)
                    row += 1
            else:
                sheet.write_rich_string(row, 1, measurebar.get('name'),
                                        bold)
                price = measurebar.get('template_price')
                sheet.write_rich_string(row, 3, str(price))
                row += 1
