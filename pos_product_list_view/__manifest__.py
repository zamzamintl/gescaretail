# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Product List View',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Pos Product List View',
    'description': """

Pos Product List View

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'view/templates.xml'
    ],
    'qweb': ['static/src/xml/pos_product_list_view.xml'],
    'installable': True,
    'auto_install': False,
    'application': True,
}
