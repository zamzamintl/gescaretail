# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Stock Move',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Pos Stock Move',
    'description': """

Pos Stock Move

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['stock', 'product_stock_grid', 'product_attribute_type'],
    'data': [
        'views/product.xml'
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
