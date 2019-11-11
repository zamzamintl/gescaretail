# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Product search View',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Pos Product search View',
    'description': """

Pos Product search View

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'view/templates.xml'
    ],
    'qweb': ['static/src/xml/pos_product_search_view.xml'],
    'installable': True,
    'auto_install': False,
    'application': True,
}
