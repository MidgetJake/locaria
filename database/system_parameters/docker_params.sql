DELETE FROM locaria_core.parameters WHERE parameter_name = 'fargate_config';

INSERT INTO locaria_core.parameters(parameter_name, parameter)
SELECT 'fargate_config',
        jsonb_build_object('file_loader',
            jsonb_build_object('task','{{themeOutputs.fileLoaderTask}}',
                                'vpcPrivateSubnetA','{{outputs.vpcPrivateSubnetA}}',
                                'vpcPrivateSubnetB','{{outputs.vpcPrivateSubnetB}}',
                                'ServerlessSecurityGroup','{{outputs.ServerlessSecurityGroup}}',
                                'ecrRepositoryUri','{{themeOutputs.ecrRepositoryUri}}',
                                'ecsName','{{themeOutputs.ecsName}}',
                                'arn','{{themeOutputs.EcsRunnerLambdaFunctionQualifiedArn}}',
                                'region','{{config.region}}'
                ));