# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Stock Grid',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to show stock on grid in pos',
    'description': """

Allow to show stock on grid in pos

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': [
        'point_of_sale',
        #        'princess_stock_grid',
        #        'princess_product_attribute_value'
    ],
    'data': [
        'view/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_stock_grid.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
