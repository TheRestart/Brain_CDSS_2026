# Generated manually - Remove AI status fields from OCS

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("ocs", "0003_add_ai_status_fields"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="ocs",
            name="ai_completed_at",
        ),
        migrations.RemoveField(
            model_name="ocs",
            name="ai_inference",
        ),
        migrations.RemoveField(
            model_name="ocs",
            name="ai_requested_at",
        ),
        migrations.RemoveField(
            model_name="ocs",
            name="ai_status",
        ),
    ]
