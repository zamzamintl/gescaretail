# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Quick Load Data',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Load more product & customer quickly',
    'description': """

Load more product & customer quickly

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/templates.xml',
    ],
    'images': ['static/description/pos_quick_load_data.png'],
    'installable': True,
    'auto_install': False,
    'application': True,
}
